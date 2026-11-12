'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { ensureMultasEETables } from '@/lib/multas-ee-db-init'
import { logAuditAction } from '@/lib/audit'
import { revalidatePath } from 'next/cache'

export interface UsuarioPrivilegioEE {
    id: string
    name: string
    username: string
    email: string | null
    roleId: string
    roleName: string
    isAdmin: boolean
    puedeEliminarIndividual: boolean
    puedeEliminarMasivo: boolean
    otorgadoPor: string | null
    updatedAt: string | null
    rbdsCount: number
}

async function checkPermission() {
    const session = await getSession()
    if (!session || !session.user) {
        throw new Error('No autorizado: Sesión no válida')
    }

    const roleName = session.user.role?.name?.toLowerCase().trim() || ''
    const perms = session.user.role?.permissions || []

    const isAuthorized =
        roleName === 'administrador' ||
        roleName === 'admin' ||
        roleName === 'super admin' ||
        roleName === 'superadministrador' ||
        perms.includes('manage_multa_privilegios')

    if (!isAuthorized) {
        throw new Error('No autorizado: Requiere permiso de gestión de privilegios de multas')
    }

    return session
}

export async function getUsuariosConPrivilegios(): Promise<{
    success: boolean
    data: UsuarioPrivilegioEE[]
    error?: string
}> {
    try {
        await checkPermission()
        await ensureMultasEETables()

        const users = await rawPrisma.user.findMany({
            where: { isDeleted: false },
            include: {
                role: {
                    select: { id: true, name: true }
                },
                privilegioEE: true
            },
            orderBy: [
                { name: 'asc' },
                { username: 'asc' }
            ]
        })

        const data: UsuarioPrivilegioEE[] = users.map(u => {
            const isAdmin = u.role?.name?.toLowerCase().trim() === 'administrador' ||
                            u.role?.name?.toLowerCase().trim() === 'admin' ||
                            u.role?.name?.toLowerCase().trim() === 'super admin'

            return {
                id: u.id,
                name: u.name || u.username,
                username: u.username,
                email: u.email,
                roleId: u.roleId,
                roleName: u.role?.name || 'Sin Rol',
                isAdmin,
                puedeEliminarIndividual: isAdmin ? true : (u.privilegioEE?.puedeEliminarIndividual ?? false),
                puedeEliminarMasivo: isAdmin ? true : (u.privilegioEE?.puedeEliminarMasivo ?? false),
                otorgadoPor: u.privilegioEE?.otorgadoPor || null,
                updatedAt: u.privilegioEE?.updatedAt ? u.privilegioEE.updatedAt.toISOString() : null,
                rbdsCount: Array.isArray(u.rbds) ? u.rbds.length : 0
            }
        })

        return { success: true, data }
    } catch (error: any) {
        console.error('Error al obtener usuarios con privilegios EE:', error)
        return { success: false, data: [], error: error.message || 'Error al obtener usuarios' }
    }
}

export async function updatePrivilegioUsuario(
    targetUserId: string,
    payload: { puedeEliminarIndividual: boolean; puedeEliminarMasivo: boolean }
): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await checkPermission()
        await ensureMultasEETables()

        const targetUser = await rawPrisma.user.findUnique({
            where: { id: targetUserId },
            include: { role: true }
        })

        if (!targetUser) {
            return { success: false, error: 'Usuario no encontrado' }
        }

        const operatorName = session.user.username || session.user.name || 'Admin'

        await rawPrisma.multas_Privilegio_EE.upsert({
            where: { userId: targetUserId },
            create: {
                userId: targetUserId,
                puedeEliminarIndividual: payload.puedeEliminarIndividual,
                puedeEliminarMasivo: payload.puedeEliminarMasivo,
                otorgadoPor: operatorName
            },
            update: {
                puedeEliminarIndividual: payload.puedeEliminarIndividual,
                puedeEliminarMasivo: payload.puedeEliminarMasivo,
                otorgadoPor: operatorName
            }
        })

        // Registro de Auditoría
        await logAuditAction({
            username: operatorName,
            userId: session.user.id,
            action: 'MODIFICAR_PRIVILEGIO_EE',
            modulo: 'Mantenedor Multas - Privilegios',
            detalle: `Actualizados privilegios de borrado en Carga EE para ${targetUser.username} (${targetUser.name || 'Sin nombre'}): Individual=${payload.puedeEliminarIndividual ? 'SI' : 'NO'}, Masivo=${payload.puedeEliminarMasivo ? 'SI' : 'NO'}`
        })

        revalidatePath('/dashboard/mantenedor/multas/privilegios')
        revalidatePath('/dashboard/areas/operaciones/elementos-esenciales')

        return { success: true }
    } catch (error: any) {
        console.error('Error al actualizar privilegio EE:', error)
        return { success: false, error: error.message || 'Error al guardar privilegios' }
    }
}

