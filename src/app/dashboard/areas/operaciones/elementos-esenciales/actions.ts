'use server'

import { prisma, rawPrisma } from '@/lib/prisma'
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

/**
 * Consulta la cantidad de descargos asociados a un conjunto de actas antes de eliminarlas,
 * para informar al usuario de manera precisa en la confirmación.
 */
export async function getDescargosImpactoBorrado(ids: string[]): Promise<{
    descargosCount: number
    folios: string[]
}> {
    try {
        if (!ids || ids.length === 0) return { descargosCount: 0, folios: [] }

        const actas = await prisma.elementosEsenciales_Cab.findMany({
            where: { id: { in: ids } },
            select: { folio: true }
        })

        const folios = actas.map(a => a.folio).filter(Boolean) as string[]
        if (folios.length === 0) return { descargosCount: 0, folios: [] }

        const descargosCount = await prisma.descargos_Cab.count({
            where: { folio: { in: folios } }
        })

        return { descargosCount, folios }
    } catch (e) {
        console.error('Error al consultar impacto de descargos:', e)
        return { descargosCount: 0, folios: [] }
    }
}

