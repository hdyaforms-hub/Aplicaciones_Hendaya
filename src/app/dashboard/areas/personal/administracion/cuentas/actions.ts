'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { ensurePersonalCuentasTables, puedeUsuarioCerrarPeriodosRH } from '@/lib/personal-cuentas-db-init'
import { getUserEffectiveRbds } from '@/lib/authFilters'
import { logAuditAction } from '@/lib/audit'

const PATH_CUENTAS = '/dashboard/areas/personal/administracion/cuentas'
const PATH_ADM_AUSENTISMO = '/dashboard/areas/personal/administracion/ausentismo'
const PATH_ADM_HEXTRA = '/dashboard/areas/personal/administracion/horas-extras'

async function checkAdminPermission() {
    const session = await getSession()
    const perms = session?.user?.role?.permissions || []
    const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'
    return isAdmin || perms.includes('manage_personal_cuentas_admin')
}

export interface UsuarioCuentaRHDTO {
    id: string
    username: string
    name: string | null
    email: string | null
    roleName: string
    areas: string[]
    rbds: number[]
    puedeCerrarPeriodos: boolean
    autorizadoPor: string | null
    autorizadoAt: string | null
    isActive: boolean
}

/**
 * Obtiene las cuentas de usuario vinculadas al área de Personal / Recursos Humanos
 * junto con su estado de permiso para cerrar o abrir períodos.
 */
export async function getUsuariosCuentasRHAction(filtro?: {
    search?: string
    filtroAlcance?: 'SOLO_RH' | 'TODOS'
}): Promise<{
    success: boolean
    data: UsuarioCuentaRHDTO[]
    error?: string
}> {
    if (!await checkAdminPermission()) {
        return { success: false, data: [], error: 'No tienes permisos para administrar cuentas de Recursos Humanos' }
    }
    await ensurePersonalCuentasTables()

    const session = await getSession()
    if (!session || !session.user) {
        return { success: false, data: [], error: 'Sesión no válida' }
    }

    try {
        const authorizedRbds = await getUserEffectiveRbds()

        // Consultamos usuarios activos que no estén eliminados
        // e incluimos su Rol, Áreas asignadas y la tabla de control de permisos de períodos
        const users = await rawPrisma.user.findMany({
            where: {
                isDeleted: false
            },
            include: {
                role: {
                    select: { name: true, permissions: true }
                },
                areas: {
                    select: { id: true, nombre: true }
                }
            },
            orderBy: [
                { name: 'asc' },
                { username: 'asc' }
            ]
        })

        // Consultar los permisos asignados en Pers_Permiso_Periodos
        const permisosRows: any[] = await rawPrisma.$queryRawUnsafe(
            `SELECT "userId", "puedeCerrarPeriodos", "autorizadoPor", "autorizadoAt" FROM "Pers_Permiso_Periodos";`
        )
        const permisosMap = new Map<string, { puedeCerrarPeriodos: boolean; autorizadoPor: string | null; autorizadoAt: string | null }>()
        for (const p of permisosRows) {
            permisosMap.set(p.userId, {
                puedeCerrarPeriodos: p.puedeCerrarPeriodos === true,
                autorizadoPor: p.autorizadoPor || null,
                autorizadoAt: p.autorizadoAt ? new Date(p.autorizadoAt).toISOString() : null
            })
        }

        // Filtro por alcance de área (Personal / Recursos Humanos o Administradores vinculados)
        const alcance = filtro?.filtroAlcance || 'SOLO_RH'

        const resultado: UsuarioCuentaRHDTO[] = []

        for (const u of users) {
            const areaNames = u.areas.map(a => a.nombre)
            const roleName = u.role?.name || 'Sin Rol'
            const permissions = u.role?.permissions || ''

            const isAreaRH = areaNames.some(a => 
                a.toLowerCase().includes('recurso') || 
                a.toLowerCase().includes('personal')
            )
            const isRoleRH = roleName.toLowerCase().includes('recurso') || roleName.toLowerCase().includes('personal')
            const isAdminRole = roleName === 'Administrador' || roleName === 'admin'
            const hasPersonalPerm = permissions.includes('personal')

            // Si se seleccionó SOLO_RH, filtramos los que pertenezcan a RRHH, rol RRHH, Admin o con permisos de personal
            if (alcance === 'SOLO_RH' && !isAreaRH && !isRoleRH && !isAdminRole && !hasPersonalPerm) {
                continue
            }

            // Restricción por RBD efectivo del usuario conectado
            if (authorizedRbds !== null && u.rbds && u.rbds.length > 0) {
                const intersect = u.rbds.filter((r: number) => authorizedRbds.includes(r))
                if (intersect.length === 0 && !isAdminRole) {
                    continue
                }
            }

            // Búsqueda por texto (nombre, username o email)
            if (filtro?.search && filtro.search.trim()) {
                const term = filtro.search.trim().toLowerCase()
                const matchUser = u.username.toLowerCase().includes(term)
                const matchName = (u.name || '').toLowerCase().includes(term)
                const matchEmail = (u.email || '').toLowerCase().includes(term)
                const matchRole = roleName.toLowerCase().includes(term)
                if (!matchUser && !matchName && !matchEmail && !matchRole) {
                    continue
                }
            }

            const perm = permisosMap.get(u.id)

            resultado.push({
                id: u.id,
                username: u.username,
                name: u.name || null,
                email: u.email || null,
                roleName,
                areas: areaNames,
                rbds: u.rbds || [],
                puedeCerrarPeriodos: perm ? perm.puedeCerrarPeriodos : false,
                autorizadoPor: perm?.autorizadoPor || null,
                autorizadoAt: perm?.autorizadoAt || null,
                isActive: u.isActive
            })
        }

        return {
            success: true,
            data: resultado
        }
    } catch (e: any) {
        console.error('Error en getUsuariosCuentasRHAction:', e)
        return {
            success: false,
            data: [],
            error: e.message || 'Error al obtener usuarios del área de Recursos Humanos'
        }
    }
}

/**
 * Alterna o establece si un usuario tiene la facultad de cerrar o abrir períodos
 * en cualquier módulo de Recursos Humanos.
 */
export async function togglePermisoCerrarPeriodosAction(
    targetUserId: string,
    nuevoEstado: boolean
): Promise<{ success: boolean; error?: string }> {
    if (!await checkAdminPermission()) {
        return { success: false, error: 'No tienes permisos para modificar facultades de períodos en Recursos Humanos' }
    }
    await ensurePersonalCuentasTables()

    const session = await getSession()
    if (!session || !session.user) {
        return { success: false, error: 'Sesión no autorizada' }
    }

    try {
        // Obtener datos del usuario objetivo para auditoría
        const targetUser = await rawPrisma.user.findUnique({
            where: { id: targetUserId },
            select: { id: true, username: true, name: true }
        })

        if (!targetUser) {
            return { success: false, error: 'Usuario objetivo no encontrado' }
        }

        const autorizadoPor = session.user.name || session.user.username || 'Administrador'
        const autorizadoPorId = session.user.id

        // Upsert en la tabla física idempotente Pers_Permiso_Periodos
        await rawPrisma.$executeRawUnsafe(`
            INSERT INTO "Pers_Permiso_Periodos" (
                "userId",
                "puedeCerrarPeriodos",
                "autorizadoPor",
                "autorizadoPorId",
                "autorizadoAt",
                "updatedAt"
            )
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT ("userId") DO UPDATE
            SET "puedeCerrarPeriodos" = EXCLUDED."puedeCerrarPeriodos",
                "autorizadoPor" = EXCLUDED."autorizadoPor",
                "autorizadoPorId" = EXCLUDED."autorizadoPorId",
                "autorizadoAt" = CURRENT_TIMESTAMP,
                "updatedAt" = CURRENT_TIMESTAMP;
        `, targetUserId, nuevoEstado, autorizadoPor, autorizadoPorId)

        // Registrar en Auditoría obligatoria
        await logAuditAction({
            username: session.user.username,
            userId: session.user.id || null,
            action: 'GESTION_PERMISO_PERIODOS_RH',
            modulo: 'Recursos Humanos',
            detalle: `Se ${nuevoEstado ? 'HABILITÓ' : 'REVOCÓ'} el permiso para cerrar/abrir períodos de Recursos Humanos al usuario "${targetUser.username}" (${targetUser.name || 'Sin Nombre'}). Realizado por ${autorizadoPor}.`
        })

        revalidatePath(PATH_CUENTAS)
        revalidatePath(PATH_ADM_AUSENTISMO)
        revalidatePath(PATH_ADM_HEXTRA)

        return { success: true }
    } catch (e: any) {
        console.error('Error al actualizar permiso de períodos:', e)
        return { success: false, error: e.message || 'Error al actualizar permiso' }
    }
}
