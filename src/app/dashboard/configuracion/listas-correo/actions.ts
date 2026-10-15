'use server'

import { prisma, rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { ensureNotificationConditionalColumns } from '@/lib/notifications-db-init'
import { PorSucursalMap } from '@/lib/distribution-lists'

export async function createListaCorreo(data: { 
    nombre: string
    descripcion: string
    para: string[]
    cc: string[]
    sucursalId?: string | null
    porSucursal?: PorSucursalMap | string | null
}) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_listas')) {
        return { error: 'No tienes permisos para realizar esta acción.' }
    }

    await ensureNotificationConditionalColumns()

    try {
        const existing = await prisma.listaCorreo.findUnique({ where: { nombre: data.nombre } })
        if (existing) {
            return { error: 'Ya existe una lista de distribución con este nombre.' }
        }

        const porSucursalStr = data.porSucursal 
            ? (typeof data.porSucursal === 'string' ? data.porSucursal : JSON.stringify(data.porSucursal)) 
            : null

        const created = await (prisma.listaCorreo as any).create({
            data: {
                nombre: data.nombre,
                descripcion: data.descripcion,
                para: JSON.stringify(data.para),
                cc: JSON.stringify(data.cc),
                sucursalId: data.sucursalId || null,
                ...(porSucursalStr ? { porSucursal: porSucursalStr } : {})
            }
        })

        if (porSucursalStr) {
            await rawPrisma.$executeRawUnsafe(`
                UPDATE "ListaCorreo" SET "porSucursal" = $1 WHERE id = $2;
            `, porSucursalStr, created.id)
        }

        revalidatePath('/dashboard/configuracion/listas-correo')
        return { success: true }
    } catch (e: any) {
        console.error('Error in create list', e)
        return { error: 'Ocurrió un error al crear la lista de distribución.' }
    }
}

export async function updateListaCorreo(id: string, data: { 
    nombre: string
    descripcion: string
    para: string[]
    cc: string[]
    sucursalId?: string | null
    porSucursal?: PorSucursalMap | string | null
}) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_listas')) {
        return { error: 'No tienes permisos para realizar esta acción.' }
    }

    await ensureNotificationConditionalColumns()

    try {
        // Verificar unicidad del nombre si lo cambió
        const existing = await prisma.listaCorreo.findFirst({
            where: { nombre: data.nombre, NOT: { id } }
        })

        if (existing) {
            return { error: 'Ya existe otra lista con este nombre.' }
        }

        const porSucursalStr = data.porSucursal 
            ? (typeof data.porSucursal === 'string' ? data.porSucursal : JSON.stringify(data.porSucursal)) 
            : null

        await (prisma.listaCorreo as any).update({
            where: { id },
            data: {
                nombre: data.nombre,
                descripcion: data.descripcion,
                para: JSON.stringify(data.para),
                cc: JSON.stringify(data.cc),
                sucursalId: data.sucursalId || null,
                porSucursal: porSucursalStr
            }
        })

        if (porSucursalStr !== undefined) {
            await rawPrisma.$executeRawUnsafe(`
                UPDATE "ListaCorreo" SET "porSucursal" = $1 WHERE id = $2;
            `, porSucursalStr, id)
        }

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
