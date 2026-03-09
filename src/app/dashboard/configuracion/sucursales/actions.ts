'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

const MANTENEDOR_PATH = '/dashboard/configuracion/sucursales'

function hasPermission(session: any) {
    return session?.user?.role?.permissions.includes('manage_sucursales')
}

// ------ LICITACIONES ------
export async function createLicitacion(licId: number, estado: number) {
    const session = await getSession()
    if (!hasPermission(session)) return { error: 'No tienes permisos.' }

    try {
        const existing = await prisma.licitacion.findUnique({ where: { licId } })
        if (existing) return { error: 'Ya existe una licitación con ese código.' }

        await prisma.licitacion.create({ data: { licId, estado } })
        revalidatePath(MANTENEDOR_PATH)
        return { success: true }
    } catch (e: any) {
        return { error: 'Ocurrió un error al crear la licitación.' }
    }
}

export async function updateLicitacion(licId: number, estado: number) {
    const session = await getSession()
    if (!hasPermission(session)) return { error: 'No tienes permisos.' }

    try {
        await prisma.licitacion.update({
            where: { licId },
            data: { estado }
        })
        revalidatePath(MANTENEDOR_PATH)
        return { success: true }
    } catch (e: any) {
        return { error: 'Ocurrió un error al actualizar la licitación.' }
    }
}


// ------ UTS (Unidades Territoriales) ------
export async function createUT(codUT: number, licId: number, estado: number) {
    const session = await getSession()
    if (!hasPermission(session)) return { error: 'No tienes permisos.' }

    try {
        const existing = await prisma.uT.findUnique({ where: { codUT } })
        if (existing) return { error: 'Ya existe una UT con ese código.' }

        await prisma.uT.create({ data: { codUT, licId, estado } })
        revalidatePath(MANTENEDOR_PATH)
        return { success: true }
    } catch (e: any) {
        return { error: 'Ocurrió un error al crear la UT. Verifique que la licitación exista.' }
    }
}

export async function updateUT(codUT: number, licId: number, estado: number) {
    const session = await getSession()
    if (!hasPermission(session)) return { error: 'No tienes permisos.' }

    try {
        await prisma.uT.update({
            where: { codUT },
            data: { licId, estado }
        })
        revalidatePath(MANTENEDOR_PATH)
        return { success: true }
    } catch (e: any) {
        return { error: 'Ocurrió un error al actualizar la UT.' }
    }
}


// ------ SUCURSALES ------
export async function createSucursal(nombre: string, utCodes: number[]) {
    const session = await getSession()
    if (!hasPermission(session)) return { error: 'No tienes permisos.' }

    try {
        const existing = await prisma.sucursal.findUnique({ where: { nombre } })
        if (existing) return { error: 'Ya existe una Sucursal con ese nombre.' }

        // Validar que las UT asignadas no pertenezcan a ninguna sucursal
        if (utCodes.length > 0) {
            const assignedUts = await prisma.uT.findMany({
                where: {
                    codUT: { in: utCodes },
                    sucursalId: { not: null }
                }
            })
            if (assignedUts.length > 0) {
                return { error: `La Unidad Territorial ${assignedUts[0].codUT} ya pertenece a una Sucursal existente. Desvincúlela primero.` }
            }
        }

        await prisma.sucursal.create({
            data: {
                nombre,
                uts: { connect: utCodes.map(cod => ({ codUT: cod })) }
            }
        })
        revalidatePath(MANTENEDOR_PATH)
        return { success: true }
    } catch (e: any) {
        return { error: 'Ocurrió un error al crear la Sucursal.' }
    }
}

export async function updateSucursal(id: string, nombre: string, utCodes: number[]) {
    const session = await getSession()
    if (!hasPermission(session)) return { error: 'No tienes permisos.' }

    try {
        const existing = await prisma.sucursal.findFirst({ where: { nombre, NOT: { id } } })
        if (existing) return { error: 'Ya existe otra Sucursal con ese nombre.' }

        // Validar que las UT asignadas no pertenezcan a OTRA sucursal
        if (utCodes.length > 0) {
            const assignedUts = await prisma.uT.findMany({
                where: {
                    codUT: { in: utCodes },
                    sucursalId: { not: null },
                    NOT: { sucursalId: id }
                }
            })
            if (assignedUts.length > 0) {
                return { error: `La Unidad Territorial ${assignedUts[0].codUT} ya pertenece a otra Sucursal diferente. Desvincúlela primero.` }
            }
        }

        // Actualizar datos de la sucursal y reconectar las UT.
        // Prisma support 'set' which overrides the connection to given associations
        await prisma.sucursal.update({
            where: { id },
            data: {
                nombre,
                uts: { set: utCodes.map(cod => ({ codUT: cod })) }
            }
        })
        revalidatePath(MANTENEDOR_PATH)
        return { success: true }
    } catch (e: any) {
        return { error: 'Ocurrió un error al actualizar la Sucursal.' }
    }
}
