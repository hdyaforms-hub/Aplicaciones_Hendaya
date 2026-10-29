'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { decryptPersonalText, cleanRut, hashRut } from '@/lib/personal-crypto'
import { ensurePersonalAtrasosTables } from '@/lib/personal-atrasos-db-init'
import { getUserEffectiveRbds } from '@/lib/authFilters'
import { getUserAssignedPersonalVisualizacion } from '@/lib/authPersonalVisualizacion'
import { logAuditAction } from '@/lib/audit'

const PATH_ASISTENCIA_ATRASOS = '/dashboard/areas/personal/asistencia/atrasos-adelantos'
const PATH_ADM_ATRASOS = '/dashboard/areas/personal/administracion/atrasos-adelantos'

async function checkPermission() {
    const session = await getSession()
    const perms = session?.user?.role?.permissions || []
    return perms.includes('view_personal_atrasos')
}

export interface AsistenciaAtrasosRegistroDTO {
    id: string
    tipo?: 'ADELANTO' | 'ATRASO'
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
    cargo: string | null
    turno: string | null
    marco: string | null
    entro: string | null
    salio: string | null
    salioTurno: string | null
    horaFinTurno?: string | null
    horaInicioTurno?: string | null
    horaLlegada?: string | null
    horaSalida?: string | null
    holguraMin?: number | null
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
}

export interface AsistenciaAtrasosResponse {
    success: boolean
    error?: string
    tipoActual?: 'ADELANTO' | 'ATRASO'
    data: AsistenciaAtrasosRegistroDTO[]
    total: number
    page: number
    pageSize: number
    sucursales: string[]
    supervisores: string[]
    establecimientos: { rbd: number; establecimiento: string }[]
    resumen?: {
        totalRegistros: number
        totalMinutosAtraso: number
        totalMinutosAdelanto: number
        totalAplicaDescuento: number
        totalJustificados: number
    }
}

export async function getAsistenciaAtrasosAction(filtros?: {
    tipo?: 'ADELANTO' | 'ATRASO'
    rbd?: number
    sucursal?: string
    supervisor?: string
    fechaDesde?: string
    fechaHasta?: string
    aplicaDescuento?: 'TODOS' | 'APLICA' | 'NO_APLICA'
    justificado?: 'TODOS' | 'CON_JUSTIFICACION' | 'SIN_JUSTIFICACION'
    search?: string
    page?: number
    pageSize?: number
    sortBy?: string
    sortDir?: 'asc' | 'desc'
}): Promise<AsistenciaAtrasosResponse> {
    if (!await checkPermission()) {
        return { success: false, error: 'No tienes permisos para visualizar atrasos y adelantos en Asistencia', data: [], total: 0, page: 1, pageSize: 10, sucursales: [], supervisores: [], establecimientos: [] }
    }
    await ensurePersonalAtrasosTables()

    const session = await getSession()
    if (!session || !session.user) {
        return { success: false, error: 'No autorizado', data: [], total: 0, page: 1, pageSize: 10, sucursales: [], supervisores: [], establecimientos: [] }
    }

    const perms = session?.user?.role?.permissions || []
    const hasGlobalPersonalPermission = perms.includes('view_all_personal_asistencia')
    const assignedPersonal = await getUserAssignedPersonalVisualizacion()
    const authorizedRbds = await getUserEffectiveRbds()
    const isGlobalAdmin = authorizedRbds === null || hasGlobalPersonalPermission

    try {
        const targetTipo = filtros?.tipo || 'ADELANTO'
        const whereConditions: string[] = [
            `("estado" IS NULL OR "estado" = 'ABIERTO')`, // En Asistencia solo se visualizan períodos abiertos
            `tipo = $1`
        ]
        const queryParams: any[] = [targetTipo]
        let paramIndex = 2

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
        } else if (!isGlobalAdmin) {
            // Lógica original existente (sin tocar para supervisores y usuarios con RBDs)
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
            // Administrador / Gerencia / Acceso Global con filtro específico
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

        // 6. Filtro Justificado
        if (filtros?.justificado && filtros.justificado !== 'TODOS') {
            if (filtros.justificado === 'CON_JUSTIFICACION') {
                whereConditions.push(`(justificado IS NOT NULL AND TRIM(justificado) <> '' AND LOWER(justificado) <> 'no')`)
            } else if (filtros.justificado === 'SIN_JUSTIFICACION') {
                whereConditions.push(`(justificado IS NULL OR TRIM(justificado) = '' OR LOWER(justificado) = 'no')`)
            }
        }

        // 7. Búsqueda por RUT directo con hash
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

        const whereSql = `WHERE ${whereConditions.join(' AND ')}`

        // Consultar listas para selects
        const sucursalesResult: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT DISTINCT sucursal FROM "Pers_Atrasos_Registro"
            ${whereSql} AND sucursal IS NOT NULL AND sucursal <> ''
            ORDER BY sucursal ASC;
        `, ...queryParams)

        const supervisoresResult: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT DISTINCT supervisor FROM "Pers_Atrasos_Registro"
            ${whereSql} AND supervisor IS NOT NULL AND supervisor <> ''
            ORDER BY supervisor ASC;
        `, ...queryParams)

        const establecimientosResult: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT DISTINCT rbd, establecimiento FROM "Pers_Atrasos_Registro"
            ${whereSql} AND rbd IS NOT NULL
            ORDER BY rbd ASC;
        `, ...queryParams)

        // Traer registros coincidentes
        const rawRegistros: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT * FROM "Pers_Atrasos_Registro"
            ${whereSql}
            ORDER BY fecha DESC, rbd ASC, id ASC;
        `, ...queryParams)

        // Desencriptar datos en memoria
        let dataDesencriptada: AsistenciaAtrasosRegistroDTO[] = rawRegistros.map((r: any) => {
            const rut = decryptPersonalText(r.identificadorEnc)
            const apellidos = decryptPersonalText(r.apellidosEnc)
            const nombre = decryptPersonalText(r.nombreEnc)
            const nombreCompleto = `${nombre} ${apellidos}`.trim()

            return {
                id: r.id,
                tipo: (r.tipo as 'ADELANTO' | 'ATRASO') || 'ADELANTO',
                cargaId: r.cargaId,
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
                horaInicioTurno: r.horaInicioTurno || null,
                horaLlegada: r.horaLlegada || null,
                horaSalida: r.horaSalida || null,
                holguraMin: r.holguraMin !== null && r.holguraMin !== undefined ? Number(r.holguraMin) : null,
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
                estado: r.estado || 'ABIERTO'
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
            let valA: any = a[sortBy as keyof AsistenciaAtrasosRegistroDTO] ?? ''
            let valB: any = b[sortBy as keyof AsistenciaAtrasosRegistroDTO] ?? ''
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
            tipoActual: targetTipo,
            data: dataFinal,
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
        console.error('Error fetching Asistencia Atrasos:', error)
        return {
            success: false,
            error: error.message || 'Error al obtener registros de atrasos y adelantos',
            data: [],
            total: 0,
            page: 1,
            pageSize: 10,
            sucursales: [],
            supervisores: [],
            establecimientos: [],
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
 * Server Action: Actualiza la justificación y si aplica descuento en un registro
 */
export async function actualizarGestionAtrasoAction(
    registroId: string,
    aplicaDescuento: boolean,
    justificado?: string,
    observacion?: string
) {
    if (!await checkPermission()) {
        return { success: false, error: 'No tienes permisos para modificar este registro' }
    }
    await ensurePersonalAtrasosTables()

    const session = await getSession()
    const usuarioNombre = session?.user?.name || session?.user?.username || 'Usuario'
    const usuarioId = session?.user?.id || null
    const perms = session?.user?.role?.permissions || []
    const hasGlobalPersonalPermission = perms.includes('view_all_personal_asistencia')
    const authorizedRbds = await getUserEffectiveRbds()
    const assignedPersonal = await getUserAssignedPersonalVisualizacion()
    const isGlobalAdmin = authorizedRbds === null || hasGlobalPersonalPermission
    const ahora = new Date()

    try {
        const rows: any[] = await rawPrisma.$queryRawUnsafe(
            `SELECT id, rbd, establecimiento, fecha, "identificadorEnc", "identificadorHash", "apellidosEnc", "nombreEnc", estado, "aplicaDescuento", justificado, "aplicaModificadoPor" FROM "Pers_Atrasos_Registro" WHERE id = $1;`,
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
        } else if (!isGlobalAdmin && currentReg.rbd) {
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
        if (!isGlobalAdmin && currentReg.aplicaModificadoPor !== null) {
            return {
                success: false,
                error: 'Este registro ya fue modificado previamente y se encuentra bloqueado. Para corregir o rectificar el estado, debe ser gestionado desde el módulo de Administración.'
            }
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

        // Registrar en Auditoría
        const colaborador = `${decryptPersonalText(currentReg.nombreEnc)} ${decryptPersonalText(currentReg.apellidosEnc)}`.trim()
        await logAuditAction({
            username: usuarioNombre,
            userId: usuarioId,
            action: 'GESTIONAR_DESCUENTO_ATRASO',
            modulo: 'Recursos Humanos',
            detalle: `Modificación de gestión para ${colaborador} (RBD ${currentReg.rbd}) fecha ${currentReg.fecha}: Descuento=${aplicaDescuento ? 'APLICA' : 'NO APLICA'}, Justificado="${justificado || 'Sin justificación'}".`
        })

        revalidatePath(PATH_ASISTENCIA_ATRASOS)
        revalidatePath(PATH_ADM_ATRASOS)

        return {
            success: true,
            aplicaDescuento,
            justificado,
            observacion,
            aplicaModificadoPor: usuarioNombre,
            aplicaModificadoAt: ahora.toISOString()
        }
    } catch (error: any) {
        console.error('Error al actualizar gestión de atraso:', error)
        return { success: false, error: error.message || 'Error al actualizar el registro' }
    }
}
