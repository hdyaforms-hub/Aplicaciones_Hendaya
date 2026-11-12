'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { ensureMultasEETables } from '@/lib/multas-ee-db-init'

export async function getUserEEPrivileges(): Promise<{
    isAdmin: boolean
    canDeleteIndividual: boolean
    canDeleteBulk: boolean
}> {
    try {
        const session = await getSession()
        if (!session?.user) {
            return { isAdmin: false, canDeleteIndividual: false, canDeleteBulk: false }
        }

        const roleName = session.user.role?.name?.toLowerCase().trim() || ''
        const isAdmin =
            roleName === 'administrador' ||
            roleName === 'admin' ||
            roleName === 'super admin' ||
            roleName === 'superadministrador'

        if (isAdmin) {
            return { isAdmin: true, canDeleteIndividual: true, canDeleteBulk: true }
        }

        await ensureMultasEETables()

        const priv = await rawPrisma.multas_Privilegio_EE.findUnique({
            where: { userId: session.user.id }
        })

        return {
            isAdmin: false,
            canDeleteIndividual: !!priv?.puedeEliminarIndividual,
            canDeleteBulk: !!priv?.puedeEliminarMasivo
        }
    } catch (e) {
        console.error('Error al verificar privilegios EE:', e)
        return { isAdmin: false, canDeleteIndividual: false, canDeleteBulk: false }
    }
}

