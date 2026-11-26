'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { logAuditAction } from '@/lib/audit'
import { revalidatePath } from 'next/cache'
import { ALL_PERMISSIONS_CATALOG, PermissionDefinition } from '@/lib/permissions-catalog'

export interface RoleMasivoItem {
    id: string
    name: string
    description: string | null
    permissions: string[]
    userCount: number
    createdAt: string
}

export interface DatosRolesMasivoResponse {
    success: boolean
    roles?: RoleMasivoItem[]
    permisos?: PermissionDefinition[]
    categorias?: string[]
    error?: string
}

async function verifyCanManageRoles(): Promise<{ usuario: string; isAdmin: boolean }> {
    const session = await getSession()
    if (!session || !session.user) {
        throw new Error('No autorizado: Sesión expirada')
    }

    const roleName = session.user.role?.name?.toLowerCase().trim() || ''
    const perms: string[] = session.user.role?.permissions || []
    const isAdmin = roleName === 'admin' || roleName === 'administrador' || roleName === 'super admin'
    const canManage = isAdmin || perms.includes('manage_roles') || perms.includes('manage_roles_masivo')

    if (!canManage) {
        throw new Error('No cuentas con permisos suficientes para administrar roles de forma masiva.')
    }

    const usuario = session.user.name || session.user.username || session.user.email || 'Administrador'
    return { usuario, isAdmin }
}

export async function obtenerDatosRolesMasivoAction(): Promise<DatosRolesMasivoResponse> {
    try {
        await verifyCanManageRoles()

        const dbRoles = await prisma.role.findMany({
            include: {
                _count: {
                    select: { users: true }
                }
            },
            orderBy: { name: 'asc' }
        })

        const roles: RoleMasivoItem[] = dbRoles.map(r => {
            let perms: string[] = []
            try {
                perms = JSON.parse(r.permissions || '[]')
            } catch {
                perms = []
            }

            return {
                id: r.id,
                name: r.name,
                description: r.description,
                permissions: perms,
                userCount: r._count.users,
                createdAt: r.createdAt.toISOString()
            }
        })

        // Extraer categorías únicas ordenadas
        const categoriasSet = new Set<string>()
        ALL_PERMISSIONS_CATALOG.forEach(p => categoriasSet.add(p.category))
        const categorias = Array.from(categoriasSet).sort()

        return {
            success: true,
            roles,
            permisos: ALL_PERMISSIONS_CATALOG,
            categorias
        }
    } catch (error: any) {
        console.error('[obtenerDatosRolesMasivoAction] Error:', error)
        return { success: false, error: error.message || 'Error al obtener roles y permisos' }
    }
}

export async function aplicarPermisosMasivoAction(data: {
    roleIds: string[]
    permissionIds: string[]
    operacion: 'agregar' | 'remover'
}): Promise<{
    success: boolean
    rolesModificados?: number
    permisosModificados?: number
    error?: string
}> {
    try {
        const { usuario } = await verifyCanManageRoles()

        if (!data.roleIds || data.roleIds.length === 0) {
            return { success: false, error: 'Debes seleccionar al menos un rol de destino.' }
        }
        if (!data.permissionIds || data.permissionIds.length === 0) {
            return { success: false, error: 'Debes seleccionar al menos un permiso/módulo a modificar.' }
        }

        const dbRoles = await prisma.role.findMany({
            where: { id: { in: data.roleIds } }
        })

        const permisosSet = new Set(data.permissionIds)
        let rolesModificados = 0
        const rolesAfectadosNombres: string[] = []

        for (const r of dbRoles) {
            let currentPerms: string[] = []
            try {
                currentPerms = JSON.parse(r.permissions || '[]')
            } catch {
                currentPerms = []
            }

            let newPerms: string[] = []
            if (data.operacion === 'agregar') {
                newPerms = Array.from(new Set([...currentPerms, ...data.permissionIds]))
            } else {
                newPerms = currentPerms.filter(p => !permisosSet.has(p))
            }

            await prisma.role.update({
                where: { id: r.id },
                data: {
                    permissions: JSON.stringify(newPerms)
                }
            })

            rolesModificados++
            rolesAfectadosNombres.push(r.name)
        }

        revalidatePath('/dashboard/roles')
        revalidatePath('/dashboard/configuracion/roles-masivo')

        await logAuditAction({
            username: usuario,
            modulo: 'Configuración -> Asignación Masiva de Roles',
            action: data.operacion === 'agregar' ? 'ASIGNACION_MASIVA' : 'REMOCION_MASIVA',
            detalle: `${data.operacion === 'agregar' ? 'Asignó' : 'Removió'} ${data.permissionIds.length} permisos en ${rolesModificados} roles (${rolesAfectadosNombres.join(', ')})`
        })

        return {
            success: true,
            rolesModificados,
            permisosModificados: data.permissionIds.length
        }
    } catch (error: any) {
        console.error('[aplicarPermisosMasivoAction] Error:', error)
        return { success: false, error: error.message || 'Error al aplicar asignación masiva de permisos' }
    }
}
