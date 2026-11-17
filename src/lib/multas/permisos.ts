import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { getUserEffectiveRbds } from '@/lib/authFilters'

export { getUserEffectiveRbds }

/**
 * Validador unificado y seguro de permisos para el módulo de Multas y Fiscalizaciones.
 * Consulta la base de datos directamente para reflejar cambios inmediatos en Roles y Perfiles.
 */
export async function checkMultasPermission(
    permission: string | string[],
    providedSession?: any
): Promise<{ authorized: boolean; user?: any; error?: string }> {
    try {
        const session = providedSession || (await getSession())
        if (!session?.user?.id) {
            return { authorized: false, error: 'Sesión no iniciada o inválida' }
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { role: true }
        })

        if (!user || !user.role) {
            return { authorized: false, error: 'Usuario o rol no encontrado' }
        }

        const roleName = user.role.name?.toLowerCase().trim() || ''
        if (roleName === 'admin' || roleName === 'administrador' || roleName === 'super admin') {
            return { authorized: true, user }
        }

        let permissions: string[] = []
        if (Array.isArray(user.role.permissions)) {
            permissions = user.role.permissions as string[]
        } else if (typeof user.role.permissions === 'string') {
            try {
                const parsed = JSON.parse(user.role.permissions)
                permissions = Array.isArray(parsed) ? parsed : [user.role.permissions]
            } catch {
                permissions = user.role.permissions.split(',').map(p => p.trim())
            }
        }

        if (permissions.includes('*')) {
            return { authorized: true, user }
        }

        const targets = Array.isArray(permission) ? permission : [permission]
        const hasPerm = targets.some(p => permissions.includes(p))

        if (!hasPerm) {
            return {
                authorized: false,
                error: `Acceso denegado: se requiere uno de los siguientes permisos: [${targets.join(', ')}]`
            }
        }

        return { authorized: true, user }
    } catch (error: any) {
        console.error('Error al verificar permiso de multas:', error)
        return { authorized: false, error: 'Error interno verificando permisos' }
    }
}
