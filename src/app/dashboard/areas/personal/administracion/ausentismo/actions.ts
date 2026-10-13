'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { decryptPersonalText } from '@/lib/personal-crypto'
import { ensurePersonalAsistenciaTables } from '@/lib/personal-db-init'
import { puedeUsuarioCerrarPeriodosRH } from '@/lib/personal-cuentas-db-init'
import { getUserEffectiveRbds } from '@/lib/authFilters'
import { logAuditAction } from '@/lib/audit'

const PATH_ADM_AUSENTISMO = '/dashboard/areas/personal/administracion/ausentismo'
const PATH_ASISTENCIA = '/dashboard/areas/personal/asistencia'

async function checkAdminPermission() {
    const session = await getSession()
    const perms = session?.user?.role?.permissions || []
    return perms.includes('manage_personal_asistencia_admin')
}

export interface AdmAsistenciaRegistroDTO {
    id: string
    cargaId: string | null
    cargaNombreArchivo?: string | null
    rut: string
    apellidos: string
    nombre: string
    nombreCompleto: string
    fecha: string
    fechaTexto: string
    rbd: number
    establecimiento: string
    supervisorNombre: string
    grupoOriginal: string
    cargo: string | null
    permisoParcial: string | null
    criterioId: string | null
    criterioNombre: string | null
    criterioColor?: string | null
    documentoUrl?: string | null
    documentoNombre?: string | null
    documentoSubidoAt?: string | null
    documentoSubidoPor?: string | null
    estado: string
    cerradoPor?: string | null
    cerradoAt?: string | null
    creadoPor: string
    fechaCreacion: string
    actualizadoPor: string | null
    fechaActualizacion: string | null
    numActualizaciones: number
}

export interface CargaHistorialDTO {
    id: string
    nombreArchivo: string
    totalRegistros: number
    nuevosRegistros: number
    actualizadosRegistros: number
    erroresRegistros: number
    estado: string
    cerradoPor?: string | null
    cerradoAt?: string | null
    cargadoPor: string
    fechaCarga: string
    observaciones?: string | null
}

export async function getAdmAusentismoRegistrosAction(filtros?: {
    rbd?: number
    fechaInicio?: string
    fechaFin?: string
    criterioId?: string | 'SIN_CRITERIO' | 'TODOS'
    estado?: string | 'TODOS' | 'ABIERTO' | 'CERRADO'
    cargaId?: string
}) {
    if (!await checkAdminPermission()) {
        return { success: false, error: 'No tienes permisos para administrar ausentismo', data: [] }
    }
    await ensurePersonalAsistenciaTables()

    const session = await getSession()
    if (!session || !session.user) {
        return { success: false, error: 'No autorizado', data: [] }
    }

    const authorizedRbds = await getUserEffectiveRbds()
    const where: any = {}

    // 1. Restricción por RBD del usuario (según su perfil)
    if (authorizedRbds !== null) {
        if (authorizedRbds.length === 0) {
            where.rbd = -999999
        } else if (filtros?.rbd) {
            where.rbd = authorizedRbds.includes(filtros.rbd) ? filtros.rbd : -999999
        } else {
            where.rbd = { in: authorizedRbds }
        }
    } else if (filtros?.rbd) {
        where.rbd = filtros.rbd
    }

    // 2. Filtro de fecha
    if (filtros?.fechaInicio || filtros?.fechaFin) {
        if (filtros.fechaInicio && filtros.fechaFin && filtros.fechaInicio === filtros.fechaFin) {
            where.fecha = filtros.fechaInicio
        } else {
            where.fecha = {}
            if (filtros.fechaInicio) where.fecha.gte = filtros.fechaInicio
            if (filtros.fechaFin) where.fecha.lte = filtros.fechaFin
        }
    }

    // 3. Filtro Criterio
    if (filtros?.criterioId && filtros.criterioId !== 'TODOS') {
        if (filtros.criterioId === 'SIN_CRITERIO') {
            where.criterioId = null
        } else {
            where.criterioId = String(filtros.criterioId)
        }
    }

    // 4. Filtro Estado (ABIERTO / CERRADO)
    if (filtros?.estado && filtros.estado !== 'TODOS') {
        where.estado = filtros.estado
    }

    // 5. Filtro Carga
    if (filtros?.cargaId && filtros.cargaId !== 'TODOS') {
        where.cargaId = filtros.cargaId
    }

    try {
        const registros: any[] = await (rawPrisma as any).pers_Asis_Registro.findMany({
            where,
            orderBy: [
                { fecha: 'desc' },
                { rbd: 'asc' },
                { id: 'asc' }
            ],
            take: 3000
        })

        // Obtener criterios para colores
        const criterios: any[] = await (rawPrisma as any).pers_Asis_Criterio.findMany()
        const criterioColorMap = new Map<string, string | null>(criterios.map((c: any) => [c.id, c.color]))

        // Obtener mapa de cargas para nombres de archivos
        const cargas: any[] = await (rawPrisma as any).pers_Asis_Carga.findMany({
            select: { id: true, nombreArchivo: true }
        })
        const cargaMap = new Map<string, string>(cargas.map((cg: any) => [cg.id, cg.nombreArchivo]))

        // Obtener supervisores asociados a RBDs
        const supervisoresRbds: any[] = await (rawPrisma as any).supervisorRbd.findMany({
            include: {
                supervisor: {
                    select: { nombre: true, apellido: true }
                }
            }
        })
        const supervisorMap = new Map<number, string>()
        for (const s of supervisoresRbds) {
            if (s.supervisor) {
                supervisorMap.set(s.rbd, `${s.supervisor.nombre} ${s.supervisor.apellido}`.trim())
            }
        }

        // Desencriptar datos en memoria
        const result: AdmAsistenciaRegistroDTO[] = registros.map((r: any) => {
            const rut = decryptPersonalText(r.rutEnc)
            const apellidos = decryptPersonalText(r.apellidosEnc)
            const nombre = decryptPersonalText(r.nombreEnc)

            return {
                id: r.id,
                cargaId: r.cargaId,
                cargaNombreArchivo: r.cargaId ? (cargaMap.get(r.cargaId) || null) : null,
                rut,
                apellidos,
                nombre,
                nombreCompleto: `${nombre} ${apellidos}`.trim(),
                fecha: r.fecha,
                fechaTexto: r.fecha,
                rbd: r.rbd,
                establecimiento: r.establecimiento,
                supervisorNombre: supervisorMap.get(r.rbd) || 'Sin Asignar',
                grupoOriginal: r.grupoOriginal || '',
                cargo: r.cargo,
                permisoParcial: r.permisoParcial,
                criterioId: r.criterioId,
                criterioNombre: r.criterioNombre,
                criterioColor: r.criterioId ? (criterioColorMap.get(r.criterioId) || '#64748b') : null,
                documentoUrl: r.documentoUrl || null,
                documentoNombre: r.documentoNombre || null,
                documentoSubidoAt: r.documentoSubidoAt ? new Date(r.documentoSubidoAt).toISOString() : null,
                documentoSubidoPor: r.documentoSubidoPor || null,
                estado: r.estado || 'ABIERTO',
                cerradoPor: r.cerradoPor || null,
                cerradoAt: r.cerradoAt ? new Date(r.cerradoAt).toISOString() : null,
                creadoPor: r.creadoPor,
                fechaCreacion: r.fechaCreacion ? new Date(r.fechaCreacion).toISOString() : '',
                actualizadoPor: r.actualizadoPor,
                fechaActualizacion: r.fechaActualizacion ? new Date(r.fechaActualizacion).toISOString() : null,
                numActualizaciones: r.numActualizaciones || 0
            }
        })

        return { success: true, data: result }
    } catch (error: any) {
        console.error('Error fetching Adm Ausentismo Registros:', error)
        return { success: false, error: error.message || 'Error al obtener registros de administración', data: [] }
    }
}

export async function getHistorialCargasAction(): Promise<{ success: boolean; data: CargaHistorialDTO[]; error?: string }> {
    if (!await checkAdminPermission()) {
        return { success: false, error: 'No tienes permisos para consultar historial de cargas', data: [] }
    }
    await ensurePersonalAsistenciaTables()

    try {
        const cargas: any[] = await (rawPrisma as any).pers_Asis_Carga.findMany({
            orderBy: { createdAt: 'desc' }
        })

        const mapped: CargaHistorialDTO[] = cargas.map((c: any) => ({
            id: c.id,
            nombreArchivo: c.nombreArchivo,
            totalRegistros: c.totalRegistros || 0,
            nuevosRegistros: c.nuevosRegistros || 0,
            actualizadosRegistros: c.actualizadosRegistros || 0,
            erroresRegistros: c.erroresRegistros || 0,
            estado: c.estado || 'ABIERTO',
            cerradoPor: c.cerradoPor || null,
            cerradoAt: c.cerradoAt ? new Date(c.cerradoAt).toISOString() : null,
            cargadoPor: c.cargadoPor,
            fechaCarga: c.createdAt ? new Date(c.createdAt).toISOString() : '',
            observaciones: c.observaciones || null
        }))

        return { success: true, data: mapped }
    } catch (error: any) {
        console.error('Error fetching historial cargas:', error)
        return { success: false, error: error.message || 'Error al obtener historial de cargas', data: [] }
    }
}

export async function checkPuedeGestionarPeriodosAction(): Promise<boolean> {
    const session = await getSession()
    if (!session?.user?.id) return false
    return await puedeUsuarioCerrarPeriodosRH(session.user.id)
}

export async function cambiarEstadoPeriodoCargaAction(cargaId: string, nuevoEstado: 'ABIERTO' | 'CERRADO') {
    if (!await checkAdminPermission()) {
        return { success: false, error: 'No tienes permisos para modificar el estado del período' }
    }
    await ensurePersonalAsistenciaTables()

    const session = await getSession()
    const usuarioNombre = session?.user?.nombre || session?.user?.email || 'Usuario'
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
        const carga = await (rawPrisma as any).pers_Asis_Carga.findUnique({
            where: { id: cargaId }
        })

        if (!carga) {
            return { success: false, error: 'Documento / Planilla de carga no encontrada' }
        }

        const cerradoPorVal = nuevoEstado === 'CERRADO' ? usuarioNombre : null
        const cerradoAtVal = nuevoEstado === 'CERRADO' ? ahora : null

        // 1. Actualizar estado de la carga
        await (rawPrisma as any).pers_Asis_Carga.update({
            where: { id: cargaId },
            data: {
                estado: nuevoEstado,
                cerradoPor: cerradoPorVal,
                cerradoAt: cerradoAtVal,
                updatedAt: ahora
            }
        })

        // 2. Actualizar en cascada todos los registros pertenecientes a este documento
        const resRegs = await (rawPrisma as any).pers_Asis_Registro.updateMany({
            where: { cargaId },
            data: {
                estado: nuevoEstado,
                cerradoPor: cerradoPorVal,
                cerradoAt: cerradoAtVal
            }
        })

        // 3. Auditoría obligatoria
        const accionAudit = nuevoEstado === 'CERRADO' ? 'CIERRE_PERIODO' : 'REAPERTURA_PERIODO'
        const detalleAudit = nuevoEstado === 'CERRADO'
            ? `Cierre del período para la carga "${carga.nombreArchivo}" (${resRegs.count} registros cerrados/bloqueados).`
            : `Reapertura del período para la carga "${carga.nombreArchivo}" (${resRegs.count} registros habilitados nuevamente).`

        await logAuditAction({
            username: usuarioNombre,
            userId: usuarioId,
            action: accionAudit,
            modulo: 'Adm. Ausentismo',
            detalle: detalleAudit
        })

        revalidatePath(PATH_ADM_AUSENTISMO)
        revalidatePath(PATH_ASISTENCIA)

        return {
            success: true,
            estado: nuevoEstado,
            totalAfectados: resRegs.count,
            message: nuevoEstado === 'CERRADO'
                ? `Período cerrado exitosamente (${resRegs.count} registros bloqueados)`
                : `Período reabierto exitosamente (${resRegs.count} registros disponibles)`
        }
    } catch (error: any) {
        console.error('Error changing period status:', error)
        return { success: false, error: error.message || 'Error al actualizar el estado del período' }
    }
}

export async function asignarCriterioAdminAction(registroId: string, criterioId: string | null) {
    if (!await checkAdminPermission()) {
        return { success: false, error: 'No tienes permisos para modificar registros' }
    }
    await ensurePersonalAsistenciaTables()

    const session = await getSession()
    const usuarioNombre = session?.user?.nombre || session?.user?.email || 'Usuario'
    const usuarioId = session?.user?.id || null
    const authorizedRbds = await getUserEffectiveRbds()
    const isAdmin = authorizedRbds === null

    try {
        const currentReg = await (rawPrisma as any).pers_Asis_Registro.findUnique({
            where: { id: registroId }
        })
        if (!currentReg) {
            return { success: false, error: 'Registro no encontrado' }
        }

        // Restricción por RBD asignado en el perfil
        if (!isAdmin) {
            if (!authorizedRbds || !authorizedRbds.includes(currentReg.rbd)) {
                return {
                    success: false,
                    error: 'No tienes autorización para modificar registros de este establecimiento'
                }
            }
        }

        // REGLA FUNDAMENTAL: Solo se puede modificar si el período está ABIERTO
        if (currentReg.estado === 'CERRADO') {
            return {
                success: false,
                error: 'El período se encuentra CERRADO. No es posible modificar el criterio de ausencia en registros cerrados.'
            }
        }

        let criterioNombre: string | null = null
        if (criterioId) {
            const crit = await (rawPrisma as any).pers_Asis_Criterio.findUnique({
                where: { id: criterioId }
            })
            if (!crit) {
                return { success: false, error: 'Criterio no encontrado' }
            }
            criterioNombre = crit.nombre
        }

        const actualizado = await (rawPrisma as any).pers_Asis_Registro.update({
            where: { id: registroId },
            data: {
                criterioId,
                criterioNombre,
                criterioAsignadoPor: usuarioNombre,
                criterioAsignadoAt: new Date(),
                actualizadoPor: usuarioNombre,
                fechaActualizacion: new Date(),
                numActualizaciones: { increment: 1 }
            }
        })

        // Auditoría
        await logAuditAction({
            username: usuarioNombre,
            userId: usuarioId,
            action: 'ACTUALIZAR_CRITERIO',
            modulo: 'Adm. Ausentismo',
            detalle: `Asignación de criterio "${criterioNombre || 'SIN CRITERIO'}" en RBD ${currentReg.rbd} (${currentReg.establecimiento}) para fecha ${currentReg.fecha}.`
        })

        revalidatePath(PATH_ADM_AUSENTISMO)
        revalidatePath(PATH_ASISTENCIA)

        return {
            success: true,
            data: {
                id: actualizado.id,
                criterioId: actualizado.criterioId,
                criterioNombre: actualizado.criterioNombre,
                actualizadoPor: actualizado.actualizadoPor,
                fechaActualizacion: actualizado.fechaActualizacion ? new Date(actualizado.fechaActualizacion).toISOString() : null
            }
        }
    } catch (error: any) {
        console.error('Error assigning criterio in Adm Ausentismo:', error)
        return { success: false, error: error.message || 'Error al actualizar criterio' }
    }
}

export async function registrarAuditoriaExportacionAction(totalRegistros: number, detalleFiltros: string) {
    if (!await checkAdminPermission()) return
    const session = await getSession()
    const usuarioNombre = session?.user?.nombre || session?.user?.email || 'Usuario'
    const usuarioId = session?.user?.id || null

    await logAuditAction({
        username: usuarioNombre,
        userId: usuarioId,
        action: 'EXPORTAR_EXCEL',
        modulo: 'Adm. Ausentismo',
        detalle: `Exportación a Excel de reporte de ausentismo con ${totalRegistros} registros. ${detalleFiltros}`
    })
}
