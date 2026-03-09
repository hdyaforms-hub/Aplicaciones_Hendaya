'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

export async function createListaCorreo(data: { nombre: string, descripcion: string, para: string[], cc: string[], sucursalId?: string | null }) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_listas')) {
        return { error: 'No tienes permisos para realizar esta acción.' }
    }

    try {
        const existing = await prisma.listaCorreo.findUnique({ where: { nombre: data.nombre } })
        if (existing) {
            return { error: 'Ya existe una lista de distribución con este nombre.' }
        }

        await prisma.listaCorreo.create({
            data: {
                nombre: data.nombre,
                descripcion: data.descripcion,
                para: JSON.stringify(data.para),
                cc: JSON.stringify(data.cc),
                sucursalId: data.sucursalId || null
            }
        })
        revalidatePath('/dashboard/configuracion/listas-correo')
        return { success: true }
    } catch (e: any) {
        console.error('Error in create list', e)
        return { error: 'Ocurrió un error al crear la lista de distribución.' }
    }
}

export async function updateListaCorreo(id: string, data: { nombre: string, descripcion: string, para: string[], cc: string[], sucursalId?: string | null }) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_listas')) {
        return { error: 'No tienes permisos para realizar esta acción.' }
    }

    try {
        // Verificar unicidad del nombre si lo cambió
        const existing = await prisma.listaCorreo.findFirst({
            where: { nombre: data.nombre, NOT: { id } }
        })

        if (existing) {
            return { error: 'Ya existe otra lista con este nombre.' }
        }

        await prisma.listaCorreo.update({
            where: { id },
            data: {
                nombre: data.nombre,
                descripcion: data.descripcion,
                para: JSON.stringify(data.para),
                cc: JSON.stringify(data.cc),
                sucursalId: data.sucursalId || null
            }
        })

        revalidatePath('/dashboard/configuracion/listas-correo')
        return { success: true }
    } catch (e: any) {
        console.error('Error in update list', e)
        return { error: 'Ocurrió un error al actualizar la lista de distribución.' }
    }
}

export async function deleteListaCorreo(id: string) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_listas')) {
        return { error: 'No tienes permisos para realizar esta acción.' }
    }

    try {
        await prisma.listaCorreo.delete({
            where: { id }
        })
        revalidatePath('/dashboard/configuracion/listas-correo')
        return { success: true }
    } catch (e: any) {
        console.error('Error in delete list', e)
        return { error: 'Ocurrió un error al eliminar la lista de distribución.' }
    }
}
