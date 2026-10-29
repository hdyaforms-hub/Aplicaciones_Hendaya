'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { logAuditAction } from '@/lib/audit'
import { ensurePrevRiesgosConfigTables } from '@/lib/prev-riesgos-db-init'
import { revalidatePath } from 'next/cache'

export interface RolVisualizableItem {
    id: string
    name: string
    description?: string | null
    activeUsersCount: number
    visualizar: boolean
}

export interface PrevRiesgosConfigResponse {
    success: boolean
    error?: string
    roles: RolVisualizableItem[]
    configuredRoles: string[] // IDs de roles con visualizar = true
    actualizadoPor?: string | null
    updatedAt?: string | null
}

/**
 * Obtiene la configuración de roles a visualizar en Prevención de Riesgos
 */
export async function getPrevRiesgosConfigData(): Promise<PrevRiesgosConfigResponse> {
    try {
        await ensurePrevRiesgosConfigTables()

        const session = await getSession()
        const permissions = session?.user?.role?.permissions || []
        const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'

        if (!isAdmin && !permissions.includes('manage_prev_riesgos_config')) {
            return {
                success: false,
                error: 'No tienes permisos para acceder a la Configuración de Prevención de Riesgos.',
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

        // 3. Obtener configuración guardada desde 'prev_riesgos_configuracion'
        const configRows = await rawPrisma.$queryRawUnsafe<{ id: string; rolesVisualizar: string; actualizadoPor?: string; updatedAt?: Date }[]>(`
            SELECT "id", "rolesVisualizar", "actualizadoPor", "updatedAt"
            FROM "prev_riesgos_configuracion"
            WHERE "id" = 'global'
            LIMIT 1;
        `)

        let configuredRoles: string[] = []
        let actualizadoPor: string | null = null
        let updatedAt: string | null = null

        if (configRows && configRows.length > 0) {
            const row = configRows[0]
            actualizadoPor = row.actualizadoPor || null
            updatedAt = row.updatedAt ? new Date(row.updatedAt).toISOString() : null
            try {
                const parsed = JSON.parse(row.rolesVisualizar || '[]')
                if (Array.isArray(parsed)) {
                    configuredRoles = parsed
                }
            } catch (e) {
                console.error('Error parseando rolesVisualizar en Prev. de Riesgos:', e)
            }
        }

        const configuredSet = new Set(configuredRoles)

        const roles: RolVisualizableItem[] = rolesDb.map(r => ({
            id: r.id,
            name: r.name,
            description: r.description,
            activeUsersCount: countMap.get(r.id) || 0,
            visualizar: configuredSet.has(r.id)
        }))

        return {
            success: true,
            roles,
            configuredRoles,
            actualizadoPor,
            updatedAt
        }
    } catch (error: any) {
        console.error('Error al obtener configuración de Prev. de Riesgos:', error)
        return {
            success: false,
            error: error?.message || 'Error inesperado al cargar la configuración.',
            roles: [],
            configuredRoles: []
        }
    }
}

/**
 * Guarda los roles autorizados para visualización en Prevención de Riesgos
 */
export async function saveRolesVisualizarAction(roleIds: string[]): Promise<{ success: boolean; error?: string }> {
    try {
        await ensurePrevRiesgosConfigTables()

        const session = await getSession()
        const permissions = session?.user?.role?.permissions || []
        const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'

        if (!isAdmin && !permissions.includes('manage_prev_riesgos_config')) {
            return {
                success: false,
                error: 'No tienes autorización para modificar la configuración de Prevención de Riesgos.'
            }
        }

        const uniqueRoleIds = Array.from(new Set(roleIds.filter(Boolean)))
        const jsonString = JSON.stringify(uniqueRoleIds)
        const currentUser = session?.user?.username || session?.user?.name || 'desconocido'

        // Obtener nombres de roles para detalle de auditoría
        const rolesNamesDb = await rawPrisma.role.findMany({
            where: { id: { in: uniqueRoleIds } },
            select: { name: true }
        })
        const nombresRoles = rolesNamesDb.map(r => r.name).join(', ')

        await rawPrisma.$executeRawUnsafe(`
            INSERT INTO "prev_riesgos_configuracion" ("id", "rolesVisualizar", "actualizadoPor", "updatedAt")
            VALUES ('global', '${jsonString.replace(/'/g, "''")}', '${currentUser.replace(/'/g, "''")}', CURRENT_TIMESTAMP)
            ON CONFLICT ("id") DO UPDATE SET
                "rolesVisualizar" = EXCLUDED."rolesVisualizar",
                "actualizadoPor" = EXCLUDED."actualizadoPor",
                "updatedAt" = CURRENT_TIMESTAMP;
        `)

        // Auditoría
        try {
            await logAuditAction({
                username: currentUser,
                userId: session?.user?.id || null,
                action: 'ACTUALIZAR_CONFIG_ROLES_RIESGOS',
                modulo: 'Mantenedor -> Prev. de Riesgos',
                detalle: `Actualizados roles a visualizar (${uniqueRoleIds.length} roles seleccionados: ${nombresRoles || 'Ninguno'})`
            })
        } catch (auditErr) {
            console.error('Error registrando auditoría en saveRolesVisualizarAction:', auditErr)
        }

        revalidatePath('/dashboard/mantenedor/prevencion-riesgos/configuracion')
        revalidatePath('/dashboard/areas/prevencion-riesgos/riesgo-minuta')

        return { success: true }
    } catch (error: any) {
        console.error('Error al guardar roles a visualizar en Prev. de Riesgos:', error)
        return {
            success: false,
            error: error?.message || 'Error inesperado al guardar la configuración.'
        }
    }
}

