'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { decryptPersonalText, cleanRut } from '@/lib/personal-crypto'
import { ensurePersonalAsistenciaTables } from '@/lib/personal-db-init'
import { ensurePersonalVisualizacionTables } from '@/lib/personal-visualizacion-db-init'
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
    institucion?: string | null
    comuna?: string | null
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
            ]
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

        // Obtener mapa de instituciones y comunas de colegios
        const colegiosInstDb = await rawPrisma.colegios.findMany({
            select: { colRBD: true, institucion: true, comuna: true }
        }).catch(() => [])
        const institucionMap = new Map<number, string>()
        const comunaMap = new Map<number, string>()
        for (const c of colegiosInstDb) {
            if (c.colRBD && c.institucion) institucionMap.set(c.colRBD, c.institucion.trim())
            if (c.colRBD && c.comuna) comunaMap.set(c.colRBD, c.comuna.trim())
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
                institucion: institucionMap.get(r.rbd) || null,
                comuna: comunaMap.get(r.rbd) || null,
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
    const usuarioNombre = session?.user?.name || session?.user?.username || session?.user?.email || 'Administrador'
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
    const usuarioNombre = session?.user?.name || session?.user?.username || session?.user?.email || 'Administrador'
    const usuarioId = session?.user?.id || null

    await logAuditAction({
        username: usuarioNombre,
        userId: usuarioId,
        action: 'EXPORTAR_EXCEL',
        modulo: 'Adm. Ausentismo',
        detalle: `Exportación a Excel de reporte de ausentismo con ${totalRegistros} registros. ${detalleFiltros}`
    })
}

export interface UsuarioFiltroDTO {
    id: string
    name: string
    username: string
    roleId: string | null
    roleName: string
    rbds: number[]
    hasVisualizacion?: boolean
    totalTrabajadores?: number
    ruts?: string[]
    rutHashes?: string[]
}

export interface FiltrosMetadatosDTO {
    roles: { id: string; name: string }[]
    usuarios: UsuarioFiltroDTO[]
    instituciones: string[]
    comunas: string[]
}

/**
 * Obtiene los metadatos necesarios para los filtros avanzados de la pestaña Ver Registros:
 * - Roles y Usuarios (con precedencia estricta de la Configuración de Visualización de Personal)
 * - Instituciones y Comunas presentes en el padrón de Colegios
 */
export async function getFiltrosMetadatosAusentismoAction(): Promise<FiltrosMetadatosDTO> {
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

        const usuarios: UsuarioFiltroDTO[] = usersDb.map(u => {
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
                roleId: u.roleId,
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
    } catch (e: any) {
        console.error('Error fetching metadatos filtros ausentismo:', e)
        return {
            roles: [],
            usuarios: [],
            instituciones: [],
            comunas: []
        }
    }
}

/**
 * Asigna un criterio de justificación en lote (masivo) a múltiples registros seleccionados.
 * Respeta la restricción de que solo registros en estado 'ABIERTO' y con RBD autorizado sean modificados.
 */
export async function asignarCriterioMasivoAction(
    registroIds: string[],
    criterioId: string | null,
    observacion?: string
): Promise<{ success: boolean; actualizados?: number; omitidos?: number; criterioNombre?: string | null; error?: string }> {
    if (!await checkAdminPermission()) {
        return { success: false, error: 'No tienes permisos administrativos para justificar registros' }
    }
    await ensurePersonalAsistenciaTables()

    const session = await getSession()
    const usuarioNombre = session?.user?.name || session?.user?.username || session?.user?.email || 'Administrador'
    const usuarioId = session?.user?.id || null
    const authorizedRbds = await getUserEffectiveRbds()
    const isAdmin = authorizedRbds === null

    if (!registroIds || registroIds.length === 0) {
        return { success: false, error: 'No se seleccionó ningún registro para justificar' }
    }

    try {
        const registros: any[] = await (rawPrisma as any).pers_Asis_Registro.findMany({
            where: { id: { in: registroIds } },
            select: { id: true, rbd: true, estado: true, establecimiento: true }
        })

        // Validar que el período esté ABIERTO y el usuario tenga acceso al RBD
        const validos = registros.filter((r: any) => {
            if (r.estado === 'CERRADO') return false
            if (!isAdmin && authorizedRbds && !authorizedRbds.includes(r.rbd)) return false
            return true
        })

        if (validos.length === 0) {
            return {
                success: false,
                error: 'Los registros seleccionados se encuentran en períodos CERRADOS o fuera de tu jurisdicción autorizada.'
            }
        }

        let criterioNombre: string | null = null
        if (criterioId) {
            const crit = await (rawPrisma as any).pers_Asis_Criterio.findUnique({
                where: { id: criterioId }
            })
            if (!crit) {
                return { success: false, error: 'Criterio seleccionado no válido' }
            }
            criterioNombre = crit.nombre
        }

        const idsValidos = validos.map((v: any) => v.id)
        const ahora = new Date()

        await (rawPrisma as any).pers_Asis_Registro.updateMany({
            where: { id: { in: idsValidos } },
            data: {
                criterioId,
                criterioNombre,
                criterioAsignadoPor: usuarioNombre,
                criterioAsignadoAt: ahora,
                actualizadoPor: usuarioNombre,
                fechaActualizacion: ahora,
                numActualizaciones: { increment: 1 }
            }
        })

        await logAuditAction({
            username: usuarioNombre,
            userId: usuarioId,
            action: 'JUSTIFICACION_MASIVA_CRITERIO',
            modulo: 'Adm. Ausentismo',
            detalle: `Justificación masiva con criterio "${criterioNombre || 'SIN CRITERIO'}" aplicada a ${idsValidos.length} registros. (Omitidos cerrados: ${registroIds.length - idsValidos.length}).${observacion ? ` Observación: ${observacion}` : ''}`
        })

        revalidatePath(PATH_ADM_AUSENTISMO)
        revalidatePath(PATH_ASISTENCIA)

        return {
            success: true,
            actualizados: idsValidos.length,
            omitidos: registroIds.length - idsValidos.length,
            criterioNombre
        }
    } catch (error: any) {
        console.error('Error in asignarCriterioMasivoAction:', error)
        return { success: false, error: error.message || 'Error al ejecutar justificación masiva' }
    }
}
