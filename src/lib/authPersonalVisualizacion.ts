import { rawPrisma } from './prisma'
import { getSession } from './session'
import { ensurePersonalVisualizacionTables } from './personal-visualizacion-db-init'

export interface UserPersonalVisualizacionAuth {
    hasConfiguredVisualizacion: boolean
    rutHashes: string[]
    rbds: number[]
    colegios: { rbd: number; establecimiento: string }[]
    totalAsignados: number
}

/**
 * Obtiene la configuración de trabajadores asignados al usuario actual en el módulo
 * de Configuración de Visualización de Personal ("Pers_Visualizacion_Jefatura").
 * 
 * Reglas de aplicación estricta:
 * 1. Si el usuario tiene trabajadores asignados (por USUARIO o por su ROL),
 *    retorna hasConfiguredVisualizacion = true y la lista de rutHashes autorizados.
 * 2. Si el usuario NO tiene configuración de visualización asignada (ejemplo: supervisores estándar
 *    o administradores no restringidos), retorna hasConfiguredVisualizacion = false,
 *    permitiendo que sigan operando exactamente con su asignación habitual por RBD ya fabricada.
 */
export async function getUserAssignedPersonalVisualizacion(overrideUserId?: string): Promise<UserPersonalVisualizacionAuth> {
    try {
        await ensurePersonalVisualizacionTables()

        const session = await getSession()
        if (!session || !session.user) {
            return {
                hasConfiguredVisualizacion: false,
                rutHashes: [],
                rbds: [],
                colegios: [],
                totalAsignados: 0
            }
        }

        const userId = overrideUserId || session.user.id
        let roleId = session.user.role?.id || (session.user as any).roleId || null

        // Si roleId no viene directamente en la cookie de sesión, consultarlo en base de datos
        if (userId && !roleId) {
            try {
                const dbUser = await rawPrisma.user.findUnique({
                    where: { id: userId },
                    select: { roleId: true }
                })
                if (dbUser?.roleId) {
                    roleId = dbUser.roleId
                }
            } catch (e) {
                console.error('Error al consultar roleId de usuario en visualización:', e)
            }
        }

        const roleName = session.user.role?.name?.toLowerCase().trim() || ''
        const isAdmin = roleName === 'admin' ||
            roleName === 'administrador' ||
            roleName === 'super admin' ||
            roleName === 'superadministrador' ||
            roleName.includes('gerencia')

        // 1. Prioridad: Asignaciones directas por USUARIO en Pers_Visualizacion_Jefatura
        let rows: any[] = []
        if (userId) {
            rows = await rawPrisma.$queryRawUnsafe(`
                SELECT DISTINCT "personalRutHash", "personalRbd", "personalEstablecimiento"
                FROM "Pers_Visualizacion_Jefatura"
                WHERE "tipo" = 'USUARIO' AND "jefaturaUserId" = $1;
            `, userId)
        }

        // 2. Si no tiene asignación directa por usuario y no es administrador global irrestricto,
        // consultar asignación por ROL
        if ((!rows || rows.length === 0) && roleId && !isAdmin) {
            rows = await rawPrisma.$queryRawUnsafe(`
                SELECT DISTINCT "personalRutHash", "personalRbd", "personalEstablecimiento"
                FROM "Pers_Visualizacion_Jefatura"
                WHERE "tipo" = 'ROL' AND "jefaturaRoleId" = $1;
            `, roleId)
        }

        // Si no tiene registros en Pers_Visualizacion_Jefatura, NO aplica restricción especial
        // y se mantiene el flujo original sin tocar por RBD (para supervisores y resto de usuarios)
        if (!rows || rows.length === 0) {
            return {
                hasConfiguredVisualizacion: false,
                rutHashes: [],
                rbds: [],
                colegios: [],
                totalAsignados: 0
            }
        }

        const rutHashes = Array.from(new Set(rows.map(r => r.personalRutHash).filter(Boolean)))
        const rbdMap = new Map<number, string>()
        for (const r of rows) {
            if (r.personalRbd) {
                rbdMap.set(Number(r.personalRbd), r.personalEstablecimiento || `RBD ${r.personalRbd}`)
            }
        }

        const rbds = Array.from(rbdMap.keys())
        const colegios = Array.from(rbdMap.entries()).map(([rbd, establecimiento]) => ({ rbd, establecimiento }))

        return {
            hasConfiguredVisualizacion: true,
            rutHashes,
            rbds,
            colegios,
            totalAsignados: rutHashes.length
        }
    } catch (error) {
        console.error('Error en getUserAssignedPersonalVisualizacion:', error)
        return {
            hasConfiguredVisualizacion: false,
            rutHashes: [],
            rbds: [],
            colegios: [],
            totalAsignados: 0
        }
    }
}

