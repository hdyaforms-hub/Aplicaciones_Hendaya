'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { decryptPersonalText, cleanRut, hashRut } from '@/lib/personal-crypto'
import { ensurePersonalAtrasosTables } from '@/lib/personal-atrasos-db-init'
import { puedeUsuarioCerrarPeriodosRH } from '@/lib/personal-cuentas-db-init'
import { getUserEffectiveRbds } from '@/lib/authFilters'
import { logAuditAction } from '@/lib/audit'

const PATH_ADM_ATRASOS = '/dashboard/areas/personal/administracion/atrasos-adelantos'
const PATH_ASISTENCIA_ATRASOS = '/dashboard/areas/personal/asistencia/atrasos-adelantos'
const PATH_CARGA_ATRASOS = '/dashboard/areas/personal/atrasos-adelantos'

async function checkAdminPermission() {
    const session = await getSession()
    const perms = session?.user?.role?.permissions || []
    return perms.includes('manage_personal_atrasos_admin')
}

export interface AdmAtrasosRegistroDTO {
    id: string
    tipo: 'ADELANTO' | 'ATRASO'
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
    sucursal: string
    supervisor: string | null
    cargo: string | null
    turno: string | null
    marco: string | null
    entro: string | null
    salio: string | null
    salioTurno: string | null
    horaFinTurno?: string | null
    horaSalida?: string | null
    horaInicioTurno?: string | null
    horaLlegada?: string | null
    holguraMin?: number
    grupoMarcacion?: string | null
    minutosAtraso: number
    minutosAdelanto: number
    minutosJustificados: number
    horasAtraso: string | null
    horasAdelanto: string | null
    justificado: string | null
    justificadoPor?: string | null
    centroCostos?: string | null
    aplicaDescuento: boolean
    aplicaModificadoPor: string | null
    aplicaModificadoAt: string | null
    observacion: string | null
    estado: string
    cerradoPor?: string | null
    cerradoAt?: string | null
}

export interface CargaAtrasosDTO {
    id: string
    tipo: 'ADELANTO' | 'ATRASO'
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

export async function getAdmAtrasosAction(filtros?: {
    tipo?: 'ADELANTO' | 'ATRASO'
    rbd?: number
    sucursal?: string
    supervisor?: string
    fechaDesde?: string
    fechaHasta?: string
    aplicaDescuento?: 'TODOS' | 'APLICA' | 'NO_APLICA'
    estado?: 'TODOS' | 'ABIERTO' | 'CERRADO'
    cargaId?: string
    search?: string
    page?: number
    pageSize?: number
    sortBy?: string
    sortDir?: 'asc' | 'desc'
}) {
    if (!await checkAdminPermission()) {
        return { success: false, error: 'No tienes permisos para administrar atrasos y adelantos', data: [], total: 0 }
    }
    await ensurePersonalAtrasosTables()

    const session = await getSession()
    if (!session || !session.user) {
        return { success: false, error: 'No autorizado', data: [], total: 0 }
    }

    const authorizedRbds = await getUserEffectiveRbds()
    const tipoActual: 'ADELANTO' | 'ATRASO' = filtros?.tipo || 'ADELANTO'

    try {
        const whereConditions: string[] = []
        const queryParams: any[] = []
        let paramIndex = 1

        // 0. Filtro por Tipo ('ADELANTO' o 'ATRASO')
        whereConditions.push(`tipo = $${paramIndex++}`)
        queryParams.push(tipoActual)

        // 1. Privilegios por RBD
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
                whereConditions.push(`rbd = ANY($${paramIndex++}::int[])`)
                queryParams.push(authorizedRbds)
            }
        } else if (filtros?.rbd) {
            whereConditions.push(`rbd = $${paramIndex++}`)
            queryParams.push(filtros.rbd)
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

        // 5. Filtro Aplica Descuento
        if (filtros?.aplicaDescuento && filtros.aplicaDescuento !== 'TODOS') {
            if (filtros.aplicaDescuento === 'APLICA') {
                whereConditions.push(`"aplicaDescuento" IS TRUE`)
            } else if (filtros.aplicaDescuento === 'NO_APLICA') {
                whereConditions.push(`("aplicaDescuento" IS FALSE OR "aplicaDescuento" IS NULL)`)
            }
        }

        // 6. Filtro Estado (ABIERTO / CERRADO)
        if (filtros?.estado && filtros.estado !== 'TODOS') {
            whereConditions.push(`estado = $${paramIndex++}`)
            queryParams.push(filtros.estado)
        }

        // 7. Filtro CargaId
        if (filtros?.cargaId && filtros.cargaId !== 'TODOS') {
            whereConditions.push(`"cargaId" = $${paramIndex++}`)
            queryParams.push(filtros.cargaId)
        }

        // 8. Búsqueda por RUT directo con hash
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

        const whereSql = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

        // Consultar mapa de cargas para asociar nombre de archivo
        const cargasMap = new Map<string, string>()
        try {
            const cargasRows: any[] = await rawPrisma.$queryRawUnsafe(`SELECT id, "nombreArchivo" FROM "Pers_Atrasos_Carga";`)
            for (const c of cargasRows) {
                cargasMap.set(c.id, c.nombreArchivo)
            }
        } catch {}

        // Listas para selects
        const sucursalesResult: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT DISTINCT sucursal FROM "Pers_Atrasos_Registro"
            ${whereSql ? whereSql + ' AND' : 'WHERE'} sucursal IS NOT NULL AND sucursal <> ''
            ORDER BY sucursal ASC;
        `, ...queryParams)

        const supervisoresResult: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT DISTINCT supervisor FROM "Pers_Atrasos_Registro"
            ${whereSql ? whereSql + ' AND' : 'WHERE'} supervisor IS NOT NULL AND supervisor <> ''
            ORDER BY supervisor ASC;
        `, ...queryParams)

        const establecimientosResult: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT DISTINCT rbd, establecimiento FROM "Pers_Atrasos_Registro"
            ${whereSql ? whereSql + ' AND' : 'WHERE'} rbd IS NOT NULL
            ORDER BY rbd ASC;
        `, ...queryParams)

        // Traer todos los registros coincidentes sin límite artificial
        const rawRegistros: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT * FROM "Pers_Atrasos_Registro"
            ${whereSql}
            ORDER BY fecha DESC, rbd ASC, id ASC;
        `, ...queryParams)

        // Desencriptar datos en memoria
        let dataDesencriptada: AdmAtrasosRegistroDTO[] = rawRegistros.map((r: any) => {
            const rut = decryptPersonalText(r.identificadorEnc)
            const apellidos = decryptPersonalText(r.apellidosEnc)
            const nombre = decryptPersonalText(r.nombreEnc)
            const nombreCompleto = `${nombre} ${apellidos}`.trim()

            return {
                id: r.id,
                tipo: (r.tipo || 'ADELANTO') as 'ADELANTO' | 'ATRASO',
                cargaId: r.cargaId,
                cargaNombreArchivo: r.cargaId ? (cargasMap.get(r.cargaId) || null) : null,
                rut,
                apellidos,
                nombre,
                nombreCompleto,
                fecha: r.fecha,
                fechaSerial: r.fechaSerial,
                rbd: r.rbd,
                establecimiento: r.establecimiento,
                sucursal: r.sucursal || 'CASA MATRIZ',
                supervisor: r.supervisor,
                cargo: r.cargo,
                turno: r.turno,
                marco: r.marco,
                entro: r.entro,
                salio: r.salio,
                salioTurno: r.salioTurno,
                horaFinTurno: r.horaFinTurno || r.salioTurno || null,
                horaSalida: r.horaSalida || null,
                horaInicioTurno: r.horaInicioTurno || null,
                horaLlegada: r.horaLlegada || null,
                holguraMin: Number(r.holguraMin || 0),
                grupoMarcacion: r.grupoMarcacion || null,
                minutosAtraso: Number(r.minutosAtraso || 0),
                minutosAdelanto: Number(r.minutosAdelanto || 0),
                minutosJustificados: Number(r.minutosJustificados || 0),
                horasAtraso: r.horasAtraso,
                horasAdelanto: r.horasAdelanto,
                justificado: r.justificado,
                justificadoPor: r.justificadoPor || null,
                centroCostos: r.centroCostos || null,
                aplicaDescuento: Boolean(r.aplicaDescuento),
                aplicaModificadoPor: r.aplicaModificadoPor,
                aplicaModificadoAt: r.aplicaModificadoAt ? new Date(r.aplicaModificadoAt).toISOString() : null,
                observacion: r.observacion,
                estado: r.estado || 'ABIERTO',
                cerradoPor: r.cerradoPor,
                cerradoAt: r.cerradoAt ? new Date(r.cerradoAt).toISOString() : null
            }
        })

        // Búsqueda por texto (nombre, cargo, establecimiento)
        if (filtros?.search && filtros.search.trim() && !searchIsRutHash) {
            const term = filtros.search.toLowerCase().trim()
            dataDesencriptada = dataDesencriptada.filter(r =>
                r.nombreCompleto.toLowerCase().includes(term) ||
                r.rut.toLowerCase().includes(term) ||
                (r.cargo && r.cargo.toLowerCase().includes(term)) ||
                (r.establecimiento && r.establecimiento.toLowerCase().includes(term))
            )
        }

        // Ordenamiento
        const sortBy = filtros?.sortBy || 'fecha'
        const sortDir = filtros?.sortDir === 'asc' ? 'asc' : 'desc'

        dataDesencriptada.sort((a, b) => {
            let valA: any = a[sortBy as keyof AdmAtrasosRegistroDTO] ?? ''
            let valB: any = b[sortBy as keyof AdmAtrasosRegistroDTO] ?? ''
            if (typeof valA === 'string') valA = valA.toLowerCase()
            if (typeof valB === 'string') valB = valB.toLowerCase()
            const comp = valA < valB ? -1 : valA > valB ? 1 : 0
            return sortDir === 'desc' ? -comp : comp
        })

        const total = dataDesencriptada.length
        const totalMinutosAtraso = Math.round(dataDesencriptada.reduce((acc, r) => acc + (r.minutosAtraso || 0), 0))
        const totalMinutosAdelanto = Math.round(dataDesencriptada.reduce((acc, r) => acc + (r.minutosAdelanto || 0), 0))
        const totalAplicaDescuento = dataDesencriptada.filter(r => r.aplicaDescuento).length
        const totalJustificados = dataDesencriptada.filter(r => !!r.justificado || r.minutosJustificados > 0).length

        const page = Math.max(1, filtros?.page || 1)
        const pageSize = Math.min(100, Math.max(5, filtros?.pageSize || 10))
        const offset = (page - 1) * pageSize
        const dataFinal = dataDesencriptada.slice(offset, offset + pageSize)

        return {
            success: true,
            data: dataFinal,
            allMatchingData: dataDesencriptada, // Utilizado para exportación directa
            total,
            page,
            pageSize,
            sucursales: sucursalesResult.map((s: any) => s.sucursal).filter(Boolean),
            supervisores: supervisoresResult.map((s: any) => s.supervisor).filter(Boolean),
            establecimientos: establecimientosResult.map((e: any) => ({
                rbd: e.rbd,
                establecimiento: e.establecimiento || `RBD ${e.rbd}`
            })),
            resumen: {
                totalRegistros: total,
                totalMinutosAtraso,
                totalMinutosAdelanto,
                totalAplicaDescuento,
                totalJustificados
            }
        }
    } catch (error: any) {
        console.error('Error fetching Adm Atrasos:', error)
        return {
            success: false,
            error: error.message || 'Error al consultar registros de atrasos y adelantos',
            data: [],
            total: 0,
            resumen: {
                totalRegistros: 0,
                totalMinutosAtraso: 0,
                totalMinutosAdelanto: 0,
                totalAplicaDescuento: 0,
                totalJustificados: 0
            }
        }
    }
}

/**
 * Server Action: Consulta el historial de planillas cargadas
 */
export async function getHistorialCargasAtrasosAction(tipo?: 'ADELANTO' | 'ATRASO'): Promise<{ success: boolean; data: CargaAtrasosDTO[]; error?: string }> {
    if (!await checkAdminPermission()) {
        return { success: false, error: 'No tienes permisos para consultar historial de cargas', data: [] }
    }
    await ensurePersonalAtrasosTables()

    try {
        const query = tipo
            ? `SELECT id, tipo, "nombreArchivo", "totalRegistros", nuevos, actualizados, estado, "cerradoPor", "cerradoAt", "cargadoPor", "fechaCarga", observaciones FROM "Pers_Atrasos_Carga" WHERE tipo = $1 ORDER BY "fechaCarga" DESC;`
            : `SELECT id, tipo, "nombreArchivo", "totalRegistros", nuevos, actualizados, estado, "cerradoPor", "cerradoAt", "cargadoPor", "fechaCarga", observaciones FROM "Pers_Atrasos_Carga" ORDER BY "fechaCarga" DESC;`

        const params = tipo ? [tipo] : []
        const rows: any[] = await rawPrisma.$queryRawUnsafe(query, ...params)

        const mapped: CargaAtrasosDTO[] = rows.map((c: any) => ({
            id: c.id,
            tipo: (c.tipo || 'ADELANTO') as 'ADELANTO' | 'ATRASO',
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
        console.error('Error fetching historial cargas atrasos:', error)
        return { success: false, error: error.message || 'Error al obtener historial de cargas', data: [] }
    }
}

/**
 * Server Action: Cierra o Reabre un período de Atrasos y Adelantos
 */
export async function cambiarEstadoPeriodoCargaAtrasosAction(cargaId: string, nuevoEstado: 'ABIERTO' | 'CERRADO') {
    if (!await checkAdminPermission()) {
        return { success: false, error: 'No tienes permisos para modificar el estado del período' }
    }
    await ensurePersonalAtrasosTables()

    const session = await getSession()
    const usuarioNombre = session?.user?.name || session?.user?.username || 'Usuario'
    const usuarioId = session?.user?.id || null
    const ahora = new Date()

    if (!usuarioId) {
        return { success: false, error: 'Sesión no válida o usuario no autenticado' }
    }

    // Validación obligatoria en Adm. de cuenta
    const puedeCerrar = await puedeUsuarioCerrarPeriodosRH(usuarioId)
    if (!puedeCerrar) {
        return {
            success: false,
            error: 'No tienes autorización para cerrar o abrir períodos en los módulos de Recursos Humanos. Solicita la activación de este permiso en "Adm. de cuenta".'
        }
    }

    try {
        const rows: any[] = await rawPrisma.$queryRawUnsafe(
            `SELECT id, "nombreArchivo", "totalRegistros" FROM "Pers_Atrasos_Carga" WHERE id = $1;`,
            cargaId
        )
        const carga = rows[0]

        if (!carga) {
            return { success: false, error: 'Planilla de atrasos no encontrada' }
        }

        const cerradoPorVal = nuevoEstado === 'CERRADO' ? usuarioNombre : null
        const cerradoAtVal = nuevoEstado === 'CERRADO' ? ahora : null

        // 1. Actualizar estado de la carga
        await rawPrisma.$executeRawUnsafe(
            `UPDATE "Pers_Atrasos_Carga"
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
                 UPDATE "Pers_Atrasos_Registro"
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

        // 3. Auditoría
        const accionAudit = nuevoEstado === 'CERRADO' ? 'CIERRE_PERIODO_ATRASOS' : 'REAPERTURA_PERIODO_ATRASOS'
        const detalleAudit = nuevoEstado === 'CERRADO'
            ? `Cierre de período para planilla "${carga.nombreArchivo}" (${totalAfectados} registros congelados).`
            : `Reapertura de período para planilla "${carga.nombreArchivo}" (${totalAfectados} registros habilitados para edición).`

        await logAuditAction({
            username: usuarioNombre,
            userId: usuarioId,
            action: accionAudit,
            modulo: 'Recursos Humanos',
            detalle: detalleAudit
        })

        revalidatePath(PATH_ADM_ATRASOS)
        revalidatePath(PATH_ASISTENCIA_ATRASOS)
        revalidatePath(PATH_CARGA_ATRASOS)

        return {
            success: true,
            estado: nuevoEstado,
            totalAfectados,
            message: nuevoEstado === 'CERRADO'
                ? `Período cerrado exitosamente (${totalAfectados} registros bloqueados)`
                : `Período reabierto exitosamente (${totalAfectados} registros habilitados)`
        }
    } catch (error: any) {
        console.error('Error changing period status atrasos:', error)
        return { success: false, error: error.message || 'Error al actualizar el estado del período' }
    }
}

/**
 * Server Action: Modificación administrativa de registro (permite cambiar descuento y justificación)
 */
export async function actualizarAtrasoAdminAction(
    registroId: string,
    aplicaDescuento: boolean,
    justificado?: string,
    observacion?: string
) {
    if (!await checkAdminPermission()) {
        return { success: false, error: 'No tienes permisos administrativos para modificar este registro' }
    }
    await ensurePersonalAtrasosTables()

    const session = await getSession()
    const usuarioNombre = session?.user?.name || session?.user?.username || 'Admin'
    const usuarioId = session?.user?.id || null
    const ahora = new Date()

    try {
        const rows: any[] = await rawPrisma.$queryRawUnsafe(
            `SELECT id, rbd, establecimiento, fecha, "identificadorEnc", "apellidosEnc", "nombreEnc" FROM "Pers_Atrasos_Registro" WHERE id = $1;`,
            registroId
        )
        const currentReg = rows[0]

        if (!currentReg) {
            return { success: false, error: 'Registro no encontrado' }
        }

        await rawPrisma.$executeRawUnsafe(
            `UPDATE "Pers_Atrasos_Registro" 
             SET "aplicaDescuento" = $1, 
                 justificado = $2,
                 observacion = $3,
                 "aplicaModificadoPor" = $4, 
                 "aplicaModificadoAt" = $5, 
                 "updatedAt" = $5
             WHERE id = $6;`,
            aplicaDescuento,
            justificado || null,
            observacion || null,
            usuarioNombre,
            ahora,
            registroId
        )

        const colaborador = `${decryptPersonalText(currentReg.nombreEnc)} ${decryptPersonalText(currentReg.apellidosEnc)}`.trim()
        await logAuditAction({
            username: usuarioNombre,
            userId: usuarioId,
            action: 'GESTION_ADMIN_ATRASO',
            modulo: 'Recursos Humanos',
            detalle: `Actualización administrativa para ${colaborador} (RBD ${currentReg.rbd}) fecha ${currentReg.fecha}: Descuento=${aplicaDescuento ? 'APLICA' : 'NO APLICA'}, Justificado="${justificado || ''}".`
        })

        revalidatePath(PATH_ADM_ATRASOS)
        revalidatePath(PATH_ASISTENCIA_ATRASOS)

        return { success: true }
    } catch (error: any) {
        console.error('Error in actualizarAtrasoAdminAction:', error)
        return { success: false, error: error.message || 'Error al actualizar el registro' }
    }
}

/**
 * Server Action: Elimina una carga completa y todos sus registros vinculados
 */
export async function eliminarCargaAtrasosAdminAction(cargaId: string): Promise<{ success: boolean; error?: string; eliminados?: number }> {
    if (!await checkAdminPermission()) {
        return { success: false, error: 'No tienes permisos administrativos para eliminar esta planilla' }
    }
    await ensurePersonalAtrasosTables()

    const session = await getSession()
    const usuarioNombre = session?.user?.name || session?.user?.username || 'Admin'
    const usuarioId = session?.user?.id || null

    try {
        const cargas: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT id, "nombreArchivo", "totalRegistros" FROM "Pers_Atrasos_Carga" WHERE id = $1;
        `, cargaId)
        const carga = cargas[0]
        if (!carga) {
            return { success: false, error: 'La planilla no existe o ya fue eliminada' }
        }

        const countRes: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT COUNT(*)::int AS count FROM "Pers_Atrasos_Registro" WHERE "cargaId" = $1;
        `, cargaId)
        const deletedCount = countRes[0]?.count || 0

        await rawPrisma.$executeRawUnsafe(`DELETE FROM "Pers_Atrasos_Registro" WHERE "cargaId" = $1;`, cargaId)
        await rawPrisma.$executeRawUnsafe(`DELETE FROM "Pers_Atrasos_Carga" WHERE id = $1;`, cargaId)

        await logAuditAction({
            username: usuarioNombre,
            userId: usuarioId,
            action: 'ELIMINAR_PLANILLA_ATRASOS',
            modulo: 'Recursos Humanos',
            detalle: `Eliminación de planilla "${carga.nombreArchivo}" (ID ${cargaId}): se borraron ${deletedCount} registros.`
        })

        revalidatePath(PATH_ADM_ATRASOS)
        revalidatePath(PATH_ASISTENCIA_ATRASOS)
        revalidatePath(PATH_CARGA_ATRASOS)

        return { success: true, eliminados: deletedCount }
    } catch (error: any) {
        console.error('Error in eliminarCargaAtrasosAdminAction:', error)
        return { success: false, error: error.message || 'Error al eliminar la planilla' }
    }
}

