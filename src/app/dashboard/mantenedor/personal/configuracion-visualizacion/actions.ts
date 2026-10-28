'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { getUserEffectiveRbds } from '@/lib/authFilters'
import { logAuditAction } from '@/lib/audit'
import { ensurePersonalVisualizacionTables } from '@/lib/personal-visualizacion-db-init'
import { ensurePersonalDotacionTables } from '@/lib/personal-dotacion-db-init'
import { decryptPersonalText, encryptPersonalText } from '@/lib/personal-crypto'
import { revalidatePath } from 'next/cache'
import { v4 as uuidv4 } from 'uuid'

const PATH_CONFIG = '/dashboard/mantenedor/personal/configuracion-visualizacion'

export interface PersonalDotacionDTO {
    id: string
    rut: string
    rutHash: string
    nombre: string
    cargo: string | null
    rbd: number | null
    establecimiento: string | null
    sucursal: string | null
}

export interface JefaturaUsuarioDTO {
    id: string
    name: string
    username: string
    email: string | null
    roleId: string
    roleName: string
    sucursales: string[]
    assignedCount: number
}

export interface RolJefaturaDTO {
    id: string
    name: string
    description: string | null
    assignedCount: number
    usersCount: number
}

export interface AsignacionJefaturaDTO {
    id: string
    tipo: 'USUARIO' | 'ROL'
    jefaturaUserId?: string | null
    jefaturaRoleId?: string | null
    jefaturaNombre: string
    jefaturaUsername?: string | null
    personalRutHash: string
    personalRut: string
    personalNombre: string
    personalCargo?: string | null
    personalRbd?: number | null
    personalEstablecimiento?: string | null
    personalSucursal?: string | null
    asignadoPor: string
    createdAt: string
}

export interface ConfiguracionVisualizacionDataResponse {
    success: boolean
    error?: string
    isRestrictedByRbd: boolean
    authorizedRbds: number[] | null
    jefaturasUsuarios: JefaturaUsuarioDTO[]
    roles: RolJefaturaDTO[]
    personalDotacion: PersonalDotacionDTO[]
    asignaciones: AsignacionJefaturaDTO[]
    colegiosDisponibles: { rbd: number; nombre: string }[]
    cargosDisponibles: string[]
}

async function checkPermission() {
    const session = await getSession()
    if (!session || !session.user) return false
    const perms = session.user.role?.permissions || []
    const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin'
    return isAdmin || perms.includes('manage_personal_visualizacion')
}

/**
 * Obtiene toda la información necesaria para el módulo de Configuración de Visualización,
 * aplicando estrictamente las restricciones de RBD según el perfil del usuario conectado.
 */
export async function getConfiguracionVisualizacionDataAction(): Promise<ConfiguracionVisualizacionDataResponse> {
    try {
        await ensurePersonalVisualizacionTables()
        await ensurePersonalDotacionTables()

        const session = await getSession()
        if (!session || !session.user) {
            return {
                success: false,
                error: 'No has iniciado sesión.',
                isRestrictedByRbd: false,
                authorizedRbds: null,
                jefaturasUsuarios: [],
                roles: [],
                personalDotacion: [],
                asignaciones: [],
                colegiosDisponibles: [],
                cargosDisponibles: []
            }
        }

        const hasPermission = await checkPermission()
        if (!hasPermission) {
            return {
                success: false,
                error: 'No tienes los permisos necesarios para acceder a la Configuración de Visualización.',
                isRestrictedByRbd: false,
                authorizedRbds: null,
                jefaturasUsuarios: [],
                roles: [],
                personalDotacion: [],
                asignaciones: [],
                colegiosDisponibles: [],
                cargosDisponibles: []
            }
        }

        // Restricción por RBD del usuario conectado
        const authorizedRbds = await getUserEffectiveRbds()
        const isRestrictedByRbd = authorizedRbds !== null

        // 1. Obtener Jefaturas desde "Gestión de Usuarios"
        // Excluimos usuarios eliminados o inactivos
        const dbUsers = await rawPrisma.user.findMany({
            where: {
                isDeleted: false,
                isActive: true
            },
            select: {
                id: true,
                name: true,
                username: true,
                email: true,
                roleId: true,
                role: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                sucursales: {
                    select: {
                        nombre: true
                    }
                }
            },
            orderBy: { name: 'asc' }
        })

        // 2. Obtener Roles disponibles en el sistema
        const dbRoles = await rawPrisma.role.findMany({
            select: {
                id: true,
                name: true,
                description: true,
                _count: {
                    select: {
                        users: {
                            where: { isDeleted: false, isActive: true }
                        }
                    }
                }
            },
            orderBy: { name: 'asc' }
        })

        // 3. Consultar asignaciones existentes en Pers_Visualizacion_Jefatura
        let sqlAsignaciones = `
            SELECT id, "tipo", "jefaturaUserId", "jefaturaRoleId", "jefaturaNombre", "jefaturaUsername",
                   "personalRutHash", "personalRutEnc", "personalNombreEnc", "personalCargo",
                   "personalRbd", "personalEstablecimiento", "personalSucursal", "asignadoPor", "createdAt"
            FROM "Pers_Visualizacion_Jefatura"
        `
        const asignacionesParams: any[] = []

        if (isRestrictedByRbd) {
            if (authorizedRbds.length === 0) {
                sqlAsignaciones += ` WHERE "personalRbd" = -999999`
            } else {
                sqlAsignaciones += ` WHERE ("personalRbd" = ANY($1) OR "personalRbd" IS NULL)`
                asignacionesParams.push(authorizedRbds)
            }
        }

        sqlAsignaciones += ` ORDER BY "createdAt" DESC;`
        const dbAsignaciones: any[] = await rawPrisma.$queryRawUnsafe(sqlAsignaciones, ...asignacionesParams)

        // Mapeo y descifrado de asignaciones existentes
        const asignaciones: AsignacionJefaturaDTO[] = dbAsignaciones.map(row => ({
            id: row.id,
            tipo: row.tipo,
            jefaturaUserId: row.jefaturaUserId,
            jefaturaRoleId: row.jefaturaRoleId,
            jefaturaNombre: row.jefaturaNombre,
            jefaturaUsername: row.jefaturaUsername,
            personalRutHash: row.personalRutHash,
            personalRut: decryptPersonalText(row.personalRutEnc || ''),
            personalNombre: decryptPersonalText(row.personalNombreEnc || ''),
            personalCargo: row.personalCargo,
            personalRbd: row.personalRbd,
            personalEstablecimiento: row.personalEstablecimiento,
            personalSucursal: row.personalSucursal,
            asignadoPor: row.asignadoPor,
            createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString()
        }))

        // Conteo de personal asignado por Usuario y por Rol
        const userAssignedCountMap = new Map<string, number>()
        const roleAssignedCountMap = new Map<string, number>()

        asignaciones.forEach(asig => {
            if (asig.tipo === 'USUARIO' && asig.jefaturaUserId) {
                userAssignedCountMap.set(asig.jefaturaUserId, (userAssignedCountMap.get(asig.jefaturaUserId) || 0) + 1)
            } else if (asig.tipo === 'ROL' && asig.jefaturaRoleId) {
                roleAssignedCountMap.set(asig.jefaturaRoleId, (roleAssignedCountMap.get(asig.jefaturaRoleId) || 0) + 1)
            }
        })

        const jefaturasUsuarios: JefaturaUsuarioDTO[] = dbUsers.map(u => ({
            id: u.id,
            name: u.name || u.username,
            username: u.username,
            email: u.email,
            roleId: u.roleId,
            roleName: u.role?.name || 'Sin Rol',
            sucursales: u.sucursales.map(s => s.nombre),
            assignedCount: userAssignedCountMap.get(u.id) || 0
        }))

        const roles: RolJefaturaDTO[] = dbRoles.map(r => ({
            id: r.id,
            name: r.name,
            description: r.description,
            assignedCount: roleAssignedCountMap.get(r.id) || 0,
            usersCount: r._count.users
        }))

        // 4. Obtener Personal desde Dotación ("Pers_Dota_Registro")
        // Filtrado por los RBDs que el usuario conectado tiene autorizados en su perfil
        let sqlPersonal = `
            SELECT DISTINCT ON ("rutHash")
                   id, "rutEnc", "rutHash", "nombreEnc", cargo, rbd, establecimiento, sucursal
            FROM "Pers_Dota_Registro"
        `
        const personalParams: any[] = []

        if (isRestrictedByRbd) {
            if (authorizedRbds.length === 0) {
                sqlPersonal += ` WHERE rbd = -999999`
            } else {
                sqlPersonal += ` WHERE (rbd = ANY($1) OR rbd IS NULL)`
                personalParams.push(authorizedRbds)
            }
        }

        sqlPersonal += ` ORDER BY "rutHash", "updatedAt" DESC;`
        const dbPersonal: any[] = await rawPrisma.$queryRawUnsafe(sqlPersonal, ...personalParams)

        // Desencriptar y estructurar la lista de colaboradores
        const colegiosMap = new Map<number, string>()
        const cargosSet = new Set<string>()

        const personalDotacion: PersonalDotacionDTO[] = dbPersonal.map(row => {
            const decRut = decryptPersonalText(row.rutEnc || '')
            const decNombre = decryptPersonalText(row.nombreEnc || '')

            if (row.rbd) {
                if (row.establecimiento) {
                    colegiosMap.set(row.rbd, row.establecimiento)
                } else if (!colegiosMap.has(row.rbd)) {
                    colegiosMap.set(row.rbd, `RBD ${row.rbd}`)
                }
            }

            if (row.cargo && row.cargo.trim()) {
                cargosSet.add(row.cargo.trim())
            }

            return {
                id: row.id,
                rut: decRut,
                rutHash: row.rutHash,
                nombre: decNombre,
                cargo: row.cargo || 'Sin Cargo',
                rbd: row.rbd,
                establecimiento: row.establecimiento || (row.rbd ? `RBD ${row.rbd}` : 'Sin Establecimiento'),
                sucursal: row.sucursal || 'CASA MATRIZ'
            }
        })

        // Ordenar alfabéticamente el personal por nombre
        personalDotacion.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }))

        const colegiosDisponibles = Array.from(colegiosMap.entries())
            .map(([rbd, nombre]) => ({ rbd, nombre }))
            .sort((a, b) => a.rbd - b.rbd)

        const cargosDisponibles = Array.from(cargosSet).sort((a, b) => a.localeCompare(b, 'es'))

        return {
            success: true,
            isRestrictedByRbd,
            authorizedRbds,
            jefaturasUsuarios,
            roles,
            personalDotacion,
            asignaciones,
            colegiosDisponibles,
            cargosDisponibles
        }
    } catch (error: any) {
        console.error('Error en getConfiguracionVisualizacionDataAction:', error)
        return {
            success: false,
            error: error.message || 'Error inesperado al cargar la configuración de visualización.',
            isRestrictedByRbd: false,
            authorizedRbds: null,
            jefaturasUsuarios: [],
            roles: [],
            personalDotacion: [],
            asignaciones: [],
            colegiosDisponibles: [],
            cargosDisponibles: []
        }
    }
}

/**
 * Guarda o actualiza las asignaciones de personal de dotación para una jefatura (Usuario o Rol).
 * Registra exhaustivamente la acción en Auditoría y valida que los RBDs pertenezcan al usuario conectado.
 */
export async function guardarAsignacionesJefaturaAction(payload: {
    tipo: 'USUARIO' | 'ROL'
    jefaturaId: string
    rutHashes: string[]
}): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
        await ensurePersonalVisualizacionTables()

        const session = await getSession()
        if (!session || !session.user) {
            return { success: false, error: 'Sesión no válida o expirada.' }
        }

        const hasPermission = await checkPermission()
        if (!hasPermission) {
            return { success: false, error: 'No tienes permisos para modificar configuraciones de visualización.' }
        }

        const { tipo, jefaturaId, rutHashes } = payload
        if (!jefaturaId) {
            return { success: false, error: 'Debes seleccionar una jefatura válida.' }
        }

        const usuarioNombre = session.user.name || session.user.username || 'Usuario'
        const usuarioId = session.user.id || null
        const authorizedRbds = await getUserEffectiveRbds()
        const isRestrictedByRbd = authorizedRbds !== null

        // 1. Resolver información de la Jefatura
        let jefaturaUserId: string | null = null
        let jefaturaRoleId: string | null = null
        let jefaturaNombre = ''
        let jefaturaUsername: string | null = null
        let jefaturaEmail: string | null = null

        if (tipo === 'USUARIO') {
            const dbUser = await rawPrisma.user.findUnique({
                where: { id: jefaturaId },
                include: { role: true }
            })
            if (!dbUser) {
                return { success: false, error: 'El usuario seleccionado no existe.' }
            }
            jefaturaUserId = dbUser.id
            jefaturaNombre = dbUser.name || dbUser.username
            jefaturaUsername = dbUser.username
            jefaturaEmail = dbUser.email
        } else {
            const dbRole = await rawPrisma.role.findUnique({
                where: { id: jefaturaId }
            })
            if (!dbRole) {
                return { success: false, error: 'El rol seleccionado no existe.' }
            }
            jefaturaRoleId = dbRole.id
            jefaturaNombre = dbRole.name
            jefaturaUsername = `Rol: ${dbRole.name}`
            jefaturaEmail = null
        }

        // 2. Obtener los datos del personal a asignar desde Dotación
        if (rutHashes.length === 0) {
            // Si el arreglo está vacío para esta jefatura, no hay nada que agregar
            return { success: true, message: 'No se seleccionó personal para asignar.' }
        }

        const personalRows: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT DISTINCT ON ("rutHash")
                   "rutEnc", "rutHash", "nombreEnc", cargo, rbd, establecimiento, sucursal
            FROM "Pers_Dota_Registro"
            WHERE "rutHash" = ANY($1)
            ORDER BY "rutHash", "updatedAt" DESC;
        `, rutHashes)

        // 3. Validar permisos de RBD: el usuario conectado no puede asignar personal de un RBD que no tenga en su perfil
        if (isRestrictedByRbd) {
            const invalidRows = personalRows.filter(p => p.rbd && !authorizedRbds.includes(p.rbd))
            if (invalidRows.length > 0) {
                return {
                    success: false,
                    error: `No puedes asignar personal del RBD ${invalidRows[0].rbd} porque no está en tus RBDs autorizados.`
                }
            }
        }

        // 4. Inserción idempotente en Pers_Visualizacion_Jefatura
        let agregadosCount = 0
        const ahora = new Date()

        for (const p of personalRows) {
            const regId = uuidv4()
            const result = await rawPrisma.$executeRawUnsafe(`
                INSERT INTO "Pers_Visualizacion_Jefatura" (
                    id, "tipo", "jefaturaUserId", "jefaturaRoleId", "jefaturaNombre", "jefaturaUsername", "jefaturaEmail",
                    "personalRutHash", "personalRutEnc", "personalNombreEnc", "personalCargo", "personalRbd",
                    "personalEstablecimiento", "personalSucursal", "asignadoPor", "asignadoPorId", "createdAt", "updatedAt"
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7,
                    $8, $9, $10, $11, $12,
                    $13, $14, $15, $16, $17, $17
                )
                ON CONFLICT DO NOTHING;
            `,
                regId, tipo, jefaturaUserId, jefaturaRoleId, jefaturaNombre, jefaturaUsername, jefaturaEmail,
                p.rutHash, p.rutEnc, p.nombreEnc, p.cargo, p.rbd,
                p.establecimiento, p.sucursal, usuarioNombre, usuarioId, ahora
            )
            agregadosCount += Number(result || 0)
        }

        // 5. Auditoría
        await logAuditAction({
            username: usuarioNombre,
            userId: usuarioId,
            action: 'ASIGNAR_PERSONAL_JEFATURA',
            modulo: 'Mantenedor -> Recursos Humanos -> Configuración de Visualización',
            detalle: `Asignación de ${personalRows.length} colaboradores a ${tipo === 'USUARIO' ? 'usuario' : 'rol'} ${jefaturaNombre} (${agregadosCount} nuevos).`
        })

        revalidatePath(PATH_CONFIG)

        return {
            success: true,
            message: `Se asociaron exitosamente ${personalRows.length} colaboradores a ${jefaturaNombre}.`
        }
    } catch (error: any) {
        console.error('Error en guardarAsignacionesJefaturaAction:', error)
        return {
            success: false,
            error: error.message || 'Error al guardar las asignaciones de visualización.'
        }
    }
}

/**
 * Desasigna o remueve personal de una jefatura (Usuario o Rol).
 */
export async function removerAsignacionesJefaturaAction(payload: {
    tipo: 'USUARIO' | 'ROL'
    jefaturaId: string
    rutHashes: string[]
}): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
        await ensurePersonalVisualizacionTables()

        const session = await getSession()
        if (!session || !session.user) {
            return { success: false, error: 'Sesión no válida o expirada.' }
        }

        const hasPermission = await checkPermission()
        if (!hasPermission) {
            return { success: false, error: 'No tienes permisos para remover asignaciones.' }
        }

        const { tipo, jefaturaId, rutHashes } = payload
        if (!jefaturaId || !rutHashes || rutHashes.length === 0) {
            return { success: false, error: 'Parámetros inválidos para remover asignaciones.' }
        }

        const usuarioNombre = session.user.name || session.user.username || 'Usuario'
        const usuarioId = session.user.id || null
        const authorizedRbds = await getUserEffectiveRbds()
        const isRestrictedByRbd = authorizedRbds !== null

        // Construir query de eliminación con seguridad de RBD
        let deleteSql = `
            DELETE FROM "Pers_Visualizacion_Jefatura"
            WHERE "tipo" = $1
              AND ${tipo === 'USUARIO' ? '"jefaturaUserId"' : '"jefaturaRoleId"'} = $2
              AND "personalRutHash" = ANY($3)
        `
        const deleteParams: any[] = [tipo, jefaturaId, rutHashes]

        if (isRestrictedByRbd) {
            if (authorizedRbds.length === 0) {
                return { success: false, error: 'No tienes RBDs asignados en tu perfil para realizar esta acción.' }
            }
            deleteSql += ` AND ("personalRbd" = ANY($4) OR "personalRbd" IS NULL)`
            deleteParams.push(authorizedRbds)
        }

        const result = await rawPrisma.$executeRawUnsafe(deleteSql, ...deleteParams)

        await logAuditAction({
            username: usuarioNombre,
            userId: usuarioId,
            action: 'DESASIGNAR_PERSONAL_JEFATURA',
            modulo: 'Mantenedor -> Recursos Humanos -> Configuración de Visualización',
            detalle: `Removidas ${result} asignaciones de personal para la jefatura (${tipo}) ${jefaturaId}.`
        })

        revalidatePath(PATH_CONFIG)

        return {
            success: true,
            message: `Se removieron ${result} asignaciones exitosamente.`
        }
    } catch (error: any) {
        console.error('Error en removerAsignacionesJefaturaAction:', error)
        return {
            success: false,
            error: error.message || 'Error al remover asignaciones.'
        }
    }
}

/**
 * Asigna todo el personal de un colegio/RBD a una jefatura específica de manera inmediata.
 */
export async function asignarTodoRbdAJefaturaAction(payload: {
    tipo: 'USUARIO' | 'ROL'
    jefaturaId: string
    rbd: number
}): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
        await ensurePersonalVisualizacionTables()
        await ensurePersonalDotacionTables()

        const session = await getSession()
        if (!session || !session.user) {
            return { success: false, error: 'Sesión no válida o expirada.' }
        }

        const hasPermission = await checkPermission()
        if (!hasPermission) {
            return { success: false, error: 'No tienes permisos para realizar esta acción.' }
        }

        const { tipo, jefaturaId, rbd } = payload
        const authorizedRbds = await getUserEffectiveRbds()

        if (authorizedRbds !== null && !authorizedRbds.includes(rbd)) {
            return { success: false, error: `El RBD ${rbd} no está dentro de los colegios autorizados en tu perfil.` }
        }

        // Obtener personal de dicho RBD
        const personalRbd: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT DISTINCT ON ("rutHash") "rutHash"
            FROM "Pers_Dota_Registro"
            WHERE rbd = $1;
        `, rbd)

        if (personalRbd.length === 0) {
            return { success: false, error: `No se encontró personal en Dotación para el RBD ${rbd}.` }
        }

        const rutHashes = personalRbd.map(p => p.rutHash)
        return await guardarAsignacionesJefaturaAction({
            tipo,
            jefaturaId,
            rutHashes
        })
    } catch (error: any) {
        console.error('Error en asignarTodoRbdAJefaturaAction:', error)
        return {
            success: false,
            error: error.message || 'Error al asignar personal por RBD.'
        }
    }
}

/**
 * Elimina todas las asignaciones existentes para una jefatura (Usuario o Rol).
 */
export async function eliminarTodaAsignacionJefaturaAction(payload: {
    tipo: 'USUARIO' | 'ROL'
    jefaturaId: string
}): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
        await ensurePersonalVisualizacionTables()

        const session = await getSession()
        if (!session || !session.user) {
            return { success: false, error: 'Sesión no válida o expirada.' }
        }

        const hasPermission = await checkPermission()
        if (!hasPermission) {
            return { success: false, error: 'No tienes permisos para modificar asignaciones.' }
        }

        const { tipo, jefaturaId } = payload
        const usuarioNombre = session.user.name || session.user.username || 'Usuario'
        const usuarioId = session.user.id || null
        const authorizedRbds = await getUserEffectiveRbds()
        const isRestrictedByRbd = authorizedRbds !== null

        let deleteSql = `
            DELETE FROM "Pers_Visualizacion_Jefatura"
            WHERE "tipo" = $1
              AND ${tipo === 'USUARIO' ? '"jefaturaUserId"' : '"jefaturaRoleId"'} = $2
        `
        const deleteParams: any[] = [tipo, jefaturaId]

        if (isRestrictedByRbd) {
            if (authorizedRbds.length === 0) {
                return { success: false, error: 'No tienes RBDs asignados en tu perfil.' }
            }
            deleteSql += ` AND ("personalRbd" = ANY($3) OR "personalRbd" IS NULL)`
            deleteParams.push(authorizedRbds)
        }

        const result = await rawPrisma.$executeRawUnsafe(deleteSql, ...deleteParams)

        await logAuditAction({
            username: usuarioNombre,
            userId: usuarioId,
            action: 'ELIMINAR_ASIGNACIONES_COMPLETAS_JEFATURA',
            modulo: 'Mantenedor -> Recursos Humanos -> Configuración de Visualización',
            detalle: `Eliminadas todas las asignaciones (${result} registros) de la jefatura (${tipo}) ${jefaturaId}.`
        })

        revalidatePath(PATH_CONFIG)

        return {
            success: true,
            message: `Se eliminaron las asignaciones de la jefatura correctamente (${result} registros).`
        }
    } catch (error: any) {
        console.error('Error en eliminarTodaAsignacionJefaturaAction:', error)
        return {
            success: false,
            error: error.message || 'Error al eliminar las asignaciones de la jefatura.'
        }
    }
}
