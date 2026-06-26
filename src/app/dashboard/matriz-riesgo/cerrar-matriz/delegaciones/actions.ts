'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

async function checkAdmin() {
    const session = await getSession()
    if (!session?.user) return false
    const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin'
    return isAdmin
}

export async function getDelegacionesData() {
    const isAdmin = await checkAdmin()
    if (!isAdmin) return { error: 'No autorizado' }

    try {
        const users = await prisma.user.findMany({
            where: {
                isDeleted: false,
                role: {
                    name: { not: 'Manipuladoras' }
                }
            },
            select: {
                id: true,
                username: true,
                name: true
            },
            orderBy: { name: 'asc' }
        })

        const sucursales = await prisma.sucursal.findMany({
            orderBy: { nombre: 'asc' }
        })

        const delegaciones = await prisma.delegacionVisualizacion.findMany({
            include: {
                user: true,
                sucursal: true
            },
            orderBy: { createdAt: 'desc' }
        })

        return { users, sucursales, delegaciones }
    } catch (e) {
        console.error(e)
        return { error: 'Error al cargar datos de delegaciones.' }
    }
}

export async function createDelegacionAction(userId: string, sucursalId: string) {
    const isAdmin = await checkAdmin()
    if (!isAdmin) return { error: 'No autorizado' }

    if (!userId || !sucursalId) {
        return { error: 'Faltan datos requeridos.' }
    }

    try {
        await prisma.delegacionVisualizacion.upsert({
            where: {
                userId_sucursalId: {
                    userId,
                    sucursalId
                }
            },
            update: {},
            create: {
                userId,
                sucursalId
            }
        })

        revalidatePath('/dashboard/matriz-riesgo/cerrar-matriz/delegaciones')
        revalidatePath('/dashboard/matriz-riesgo/cerrar-matriz')
        return { success: true }
    } catch (e) {
        console.error(e)
        return { error: 'Error al crear la delegación.' }
    }
}

export async function deleteDelegacionAction(delegationId: string) {
    const isAdmin = await checkAdmin()
    if (!isAdmin) return { error: 'No autorizado' }

    try {
        await prisma.delegacionVisualizacion.delete({
            where: { id: delegationId }
        })

        revalidatePath('/dashboard/matriz-riesgo/cerrar-matriz/delegaciones')
        revalidatePath('/dashboard/matriz-riesgo/cerrar-matriz')
        return { success: true }
    } catch (e) {
        console.error(e)
        return { error: 'Error al eliminar la delegación.' }
    }
}
