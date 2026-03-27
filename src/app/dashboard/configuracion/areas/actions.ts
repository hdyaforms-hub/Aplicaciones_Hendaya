'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

const MANTENEDOR_PATH = '/dashboard/configuracion/areas'

async function hasPermission() {
    const session = await getSession()
    return session?.user?.role?.permissions.includes('manage_areas')
}

export async function getAreas() {
    try {
        return await prisma.area.findMany({
            orderBy: { nombre: 'asc' }
        })
    } catch (error) {
        console.error('Error fetching areas:', error)
        return []
    }
}

export async function createArea(nombre: string, isActive: boolean) {
    if (!await hasPermission()) return { error: 'No tienes permisos para esta acción' }

    try {
        await prisma.area.create({
            data: { nombre, isActive }
        })
        revalidatePath(MANTENEDOR_PATH)
        revalidatePath('/dashboard/formularios/abrir')
        revalidatePath('/dashboard/formularios/crear')
        return { success: true }
    } catch (error) {
        console.error('Error creating area:', error)
        return { error: 'Error al crear el área' }
    }
}

export async function updateArea(id: number, nombre: string, isActive: boolean) {
    if (!await hasPermission()) return { error: 'No tienes permisos para esta acción' }

    try {
        await prisma.area.update({
            where: { id },
            data: { nombre, isActive }
        })
        revalidatePath(MANTENEDOR_PATH)
        revalidatePath('/dashboard/formularios/abrir')
        return { success: true }
    } catch (error) {
        console.error('Error updating area:', error)
        return { error: 'Error al actualizar el área' }
    }
}

export async function deleteArea(id: number) {
    if (!await hasPermission()) return { error: 'No tienes permisos para esta acción' }

    try {
        // Check if area has forms
        const formCount = await prisma.formDefinition.count({ where: { areaId: id } })
        if (formCount > 0) {
            return { error: 'No se puede eliminar un área que tiene formularios asociados' }
        }

        await prisma.area.delete({ where: { id } })
        revalidatePath(MANTENEDOR_PATH)
        revalidatePath('/dashboard/formularios/abrir')
        return { success: true }
    } catch (error) {
        console.error('Error deleting area:', error)
        return { error: 'Error al eliminar el área' }
    }
}
