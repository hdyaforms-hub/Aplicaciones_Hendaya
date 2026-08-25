import { rawPrisma } from '@/lib/prisma'
import { NivelPermiso } from '@/types/documentos'

const PERMISSION_WEIGHTS: Record<NivelPermiso, number> = {
    ver: 1,
    descargar: 2,
    ver_descargar: 2,
    subir: 3,
    administrar: 4
}

/**
 * Normaliza los permisos del usuario desde string JSON o array.
 */
export function normalizeUserPermissions(raw: any): string[] {
    if (!raw) return []
    if (Array.isArray(raw)) return raw
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw)
            return Array.isArray(parsed) ? parsed : []
        } catch {
            return []
        }
    }
    return []
}

/**
 * Determina si el usuario tiene rol de administrador o permiso global de gestión.
 */
export function isGlobalDocAdmin(user: any): boolean {
    if (!user) return false
    const roleName = user.role?.name?.toLowerCase() || ''
    if (roleName.includes('admin') || roleName.includes('administrador') || roleName.includes('gerencia')) {
        return true
    }

    const permissions = normalizeUserPermissions(user.role?.permissions)
    return permissions.includes('manage_doc_privilegios') || permissions.includes('manage_doc_configuracion')
}

/**
 * Construye las condiciones OR de búsqueda de privilegios para un usuario,
 * evaluando Usuario, Rol, Sucursales, Licitaciones y RBDs asignados.
 */
export async function getUserPrivilegeConditions(userId: string, userRoleId?: string): Promise<any[]> {
    const matchConditions: any[] = [
        { tipo: 'usuario', referenciaId: userId }
    ]

    if (userRoleId) {
        matchConditions.push({ tipo: 'rol', referenciaId: userRoleId })
    }

    if (userId) {
        try {
            const dbUser = await rawPrisma.user.findUnique({
                where: { id: userId },
                select: {
                    roleId: true,
                    rbds: true,
                    sucursales: { select: { id: true } },
                    licitaciones: { select: { licId: true } }
                }
            })

            if (dbUser) {
                if (dbUser.roleId && !userRoleId) {
                    matchConditions.push({ tipo: 'rol', referenciaId: dbUser.roleId })
                }

                const sucursalIds = dbUser.sucursales.map(s => s.id)
                if (sucursalIds.length > 0) {
                    matchConditions.push({ tipo: 'sucursal', referenciaId: { in: sucursalIds } })
                }

                const licitacionIds = dbUser.licitaciones.map(l => String(l.licId))
                if (licitacionIds.length > 0) {
                    matchConditions.push({ tipo: 'licitacion', referenciaId: { in: licitacionIds } })
                }

                const rbds = dbUser.rbds || []
                if (rbds.length > 0) {
                    matchConditions.push({ tipo: 'rbd', referenciaId: { in: rbds.map(String) } })
                }
            }
        } catch (e) {
            console.error('Error al obtener relaciones de usuario para permisos documentales:', e)
        }
    }

    return matchConditions
}

/**
 * Verifica si un usuario tiene un nivel de permiso específico sobre una carpeta documental.
 */
export async function canUserAccessFolder(
    userId: string,
    userRoleId: string | undefined,
    userPermissions: string[],
    carpetaId: string,
    requiredPermiso: NivelPermiso
): Promise<boolean> {
    if (!userId) return false

    // Administradores globales tienen acceso irrestricto
    if (userPermissions.includes('manage_doc_privilegios') || userPermissions.includes('manage_doc_carpetas')) {
        return true
    }

    const matchConditions = await getUserPrivilegeConditions(userId, userRoleId)

    const privilegios = await rawPrisma.privilegioDocumental.findMany({
        where: {
            carpetaId,
            OR: matchConditions
        }
    })

    if (privilegios.length === 0) {
        return false
    }

    const requiredWeight = PERMISSION_WEIGHTS[requiredPermiso]

    // Comprobar si alguno de los privilegios asignados satisface o supera el peso requerido
    for (const p of privilegios) {
        const pLevel = p.permiso as NivelPermiso
        const pWeight = PERMISSION_WEIGHTS[pLevel] || 0
        if (pWeight >= requiredWeight) {
            return true
        }
    }

    return false
}

/**
 * Obtiene el set completo de permisos computados para un usuario sobre una carpeta.
 */
export async function getUserFolderPermissions(
    user: any,
    carpetaId: string
): Promise<{
    puedeVer: boolean
    puedeDescargar: boolean
    puedeSubir: boolean
    puedeAdministrar: boolean
}> {
    if (!user) {
        return { puedeVer: false, puedeDescargar: false, puedeSubir: false, puedeAdministrar: false }
    }

    const permissions = normalizeUserPermissions(user.role?.permissions)
    const isAdmin = isGlobalDocAdmin(user) || permissions.includes('manage_doc_privilegios') || permissions.includes('manage_doc_carpetas')

    if (isAdmin) {
        return { puedeVer: true, puedeDescargar: true, puedeSubir: true, puedeAdministrar: true }
    }

    const userId = user.id
    const userRoleId = user.roleId || user.role?.id

    const matchConditions = await getUserPrivilegeConditions(userId, userRoleId)

    const privilegios = await rawPrisma.privilegioDocumental.findMany({
        where: {
            carpetaId,
            OR: matchConditions
        }
    })

    let maxWeight = 0
    for (const p of privilegios) {
        const weight = PERMISSION_WEIGHTS[p.permiso as NivelPermiso] || 0
        if (weight > maxWeight) {
            maxWeight = weight
        }
    }

    return {
        puedeVer: maxWeight >= PERMISSION_WEIGHTS.ver,
        puedeDescargar: maxWeight >= PERMISSION_WEIGHTS.descargar || maxWeight >= PERMISSION_WEIGHTS.administrar,
        puedeSubir: maxWeight >= PERMISSION_WEIGHTS.subir || maxWeight >= PERMISSION_WEIGHTS.administrar,
        puedeAdministrar: maxWeight >= PERMISSION_WEIGHTS.administrar
    }
}

/**
 * Retorna todos los IDs de carpetas que el usuario tiene permitido al menos 'ver'.
 */
export async function getFolderIdsForUser(user: any): Promise<string[]> {
    if (!user) return []

    const permissions = normalizeUserPermissions(user.role?.permissions)
    const isAdmin = isGlobalDocAdmin(user) || permissions.includes('manage_doc_privilegios')

    if (isAdmin) {
        const allFolders = await rawPrisma.carpetaDocumental.findMany({
            where: { activa: true },
            select: { id: true }
        })
        return allFolders.map(f => f.id)
    }

    const userId = user.id
    const userRoleId = user.roleId || user.role?.id

    const matchConditions = await getUserPrivilegeConditions(userId, userRoleId)

    const privilegios = await rawPrisma.privilegioDocumental.findMany({
        where: {
            OR: matchConditions
        },
        select: {
            carpetaId: true
        }
    })

    return Array.from(new Set(privilegios.map(p => p.carpetaId)))
}
