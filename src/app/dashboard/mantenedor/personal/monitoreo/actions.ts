'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { logAuditAction } from '@/lib/audit'
import { ensureMonitoreoRRHHTables } from '@/lib/monitoreo-rrhh-db-init'
import { revalidatePath } from 'next/cache'

export interface RolMonitoreable {
    id: string
    name: string
    description?: string | null
    activeUsersCount: number
}

export interface MonitoreoRRHHConfigResponse {
    success: boolean
    error?: string
    roles: RolMonitoreable[]
    configuredRoles: string[] // IDs de roles seleccionados
    actualizadoPor?: string | null
    updatedAt?: string | null
}

export async function getMonitoreoRRHHConfigData(): Promise<MonitoreoRRHHConfigResponse> {
    try {
        await ensureMonitoreoRRHHTables()

        const session = await getSession()
        const permissions = session?.user?.role?.permissions || []
        const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'

        if (!isAdmin && !permissions.includes('manage_mantenedor_monitoreo_rrhh')) {
            return {
                success: false,
                error: 'No tienes permisos para acceder al Mantenedor de Monitoreo RRHH.',
                roles: [],
                configuredRoles: []
            }
        }

        // 1. Obtener todos los roles disponibles en el sistema
        const rolesDb = await rawPrisma.role.findMany({
            select: {
                id: true,
                name: true,
                description: true
            },
            orderBy: { name: 'asc' }
        })

        // 2. Conteo de usuarios activos asignados a cada rol
        const userCounts = await rawPrisma.user.groupBy({
            by: ['roleId'],
            _count: { id: true },
            where: { isDeleted: false, isActive: true }
        })

        const countMap = new Map<string, number>()
        userCounts.forEach(c => {
            if (c.roleId) countMap.set(c.roleId, c._count.id)
        })

        const roles: RolMonitoreable[] = rolesDb.map(r => ({
            id: r.id,
            name: r.name,
            description: r.description,
            activeUsersCount: countMap.get(r.id) || 0
        }))

        // 3. Obtener la configuración guardada
        const configRows: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT "rolesAsignados", "actualizadoPor", "updatedAt"
            FROM "monitoreo_rrhh_configuracion"
            WHERE "id" = 'global'
            LIMIT 1;
        `)

        let configuredRoles: string[] = []
        let actualizadoPor: string | null = null
        let updatedAt: string | null = null

        if (configRows && configRows.length > 0) {
            actualizadoPor = configRows[0].actualizadoPor || null
            updatedAt = configRows[0].updatedAt ? new Date(configRows[0].updatedAt).toISOString() : null
            try {
                const parsed = JSON.parse(configRows[0].rolesAsignados || '[]')
                configuredRoles = Array.isArray(parsed) ? parsed : []
            } catch {
                configuredRoles = []
            }
        }

        return {
            success: true,
            roles,
            configuredRoles,
            actualizadoPor,
            updatedAt
        }
    } catch (error: any) {
        console.error('Error al obtener datos de configuración Monitoreo RRHH:', error)
        return {
            success: false,
            error: error.message || 'Error al cargar la configuración.',
            roles: [],
            configuredRoles: []
        }
    }
}

export async function guardarRolesMonitoreoRRHHAction(roleIds: string[]) {
    try {
        await ensureMonitoreoRRHHTables()

        const session = await getSession()
        const permissions = session?.user?.role?.permissions || []
        const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'

        if (!isAdmin && !permissions.includes('manage_mantenedor_monitoreo_rrhh')) {
            return {
                success: false,
                error: 'No tienes permisos para modificar los roles asignados a monitoreo RRHH.'
            }
        }

        const usuarioNombre = session?.user?.name || session?.user?.username || 'Usuario'
        const usuarioId = session?.user?.id || null
        const jsonRoles = JSON.stringify(roleIds)
        const ahora = new Date()

        await rawPrisma.$executeRawUnsafe(`
            INSERT INTO "monitoreo_rrhh_configuracion" ("id", "rolesAsignados", "actualizadoPor", "updatedAt")
            VALUES ('global', $1, $2, $3)
            ON CONFLICT ("id") DO UPDATE SET
                "rolesAsignados" = EXCLUDED."rolesAsignados",
                "actualizadoPor" = EXCLUDED."actualizadoPor",
                "updatedAt" = EXCLUDED."updatedAt";
        `, jsonRoles, usuarioNombre, ahora)

        // Obtener nombres de roles seleccionados para auditoría legible
        const rolesSelec = await rawPrisma.role.findMany({
            where: { id: { in: roleIds } },
            select: { name: true }
        })
        const nombresRoles = rolesSelec.map(r => r.name).join(', ')

        await logAuditAction({
            username: usuarioNombre,
            userId: usuarioId,
            action: 'CONFIG_ROLES_MONITOREO_RRHH',
            modulo: 'Mantenedor -> Recursos Humanos',
            detalle: `Actualización de roles sujetos a monitoreo RRHH (${roleIds.length} roles seleccionados: ${nombresRoles || 'Ninguno'}).`
        })

        revalidatePath('/dashboard/mantenedor/personal/monitoreo')
        revalidatePath('/dashboard/tablero/monitoreo-rrhh')

        return {
            success: true,
            message: 'Roles de monitoreo RRHH guardados exitosamente.'
        }
    } catch (error: any) {
        console.error('Error al guardar roles monitoreados RRHH:', error)
        return {
            success: false,
            error: error.message || 'Error al guardar la configuración de roles.'
        }
    }
}
