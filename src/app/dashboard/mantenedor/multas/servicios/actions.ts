'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

const PATH = '/dashboard/mantenedor/multas/servicios'

async function checkPermission() {
    const session = await getSession()
    if (!session) return false

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { role: true }
    })

    if (!user) return false
    const permissions = JSON.parse(user.role.permissions as string)
    return permissions.includes('manage_multa_servicios')
}

export async function getMultaServicios() {
    if (!await checkPermission()) return { error: 'No tienes permisos.' }

    try {
        const servicios = await prisma.multaServicio.findMany({
            orderBy: { codigo: 'asc' }
        })
        return { servicios }
    } catch (e) {
        return { error: 'Error al consultar servicios.' }
    }
}

export async function saveMultaServicio(data: { id?: string, codigo: string, nombre: string }) {
    if (!await checkPermission()) return { error: 'No tienes permisos.' }

    try {
        if (data.id) {
            await prisma.multaServicio.update({
                where: { id: data.id },
                data: { codigo: data.codigo, nombre: data.nombre }
            })
        } else {
            const existing = await prisma.multaServicio.findUnique({ where: { codigo: data.codigo } })
            if (existing) return { error: `Ya existe el código de servicio ${data.codigo}.` }

            await prisma.multaServicio.create({ data: { codigo: data.codigo, nombre: data.nombre } })
        }
        revalidatePath(PATH)
        return { success: true }
    } catch (e) {
        return { error: 'Error al guardar el servicio.' }
    }
}

export async function deleteMultaServicio(id: string) {
    if (!await checkPermission()) return { error: 'No tienes permisos.' }

    try {
        await prisma.multaServicio.delete({ where: { id } })
        revalidatePath(PATH)
        return { success: true }
    } catch (e) {
        return { error: 'Error al eliminar el servicio.' }
    }
}
