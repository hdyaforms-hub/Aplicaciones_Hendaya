'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

export type AnexoData = {
    id?: string
    sucursal: string
    cargo: string
    correo: string
    telefono1: string
    telefono2?: string
    telefono3?: string
    telefono4?: string
    nombre: string
    cumpleano?: string
    contacto?: string
    nota?: string
}

export async function getAnexos(filters?: { sucursal?: string, nombre?: string }) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_anexos')) {
        throw new Error('No tienes permisos para ver anexos')
    }

    const where: any = {}
    if (filters?.sucursal) where.sucursal = { contains: filters.sucursal }
    if (filters?.nombre) where.nombre = { contains: filters.nombre }

    return await prisma.anexo.findMany({
        where,
        orderBy: { nombre: 'asc' }
    })
}

export async function upsertAnexo(data: AnexoData) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_anexos')) {
        return { error: 'No tienes permisos para gestionar anexos' }
    }

    try {
        if (data.id) {
            await prisma.anexo.update({
                where: { id: data.id },
                data: {
                    ...data,
                    id: undefined
                }
            })
        } else {
            await prisma.anexo.create({
                data: data as any
            })
        }
        revalidatePath('/dashboard/ayuda/agregar')
        revalidatePath('/dashboard/ayuda/ver')
        return { success: true }
    } catch (error) {
        console.error('Error upserting anexo:', error)
        return { error: 'Error al guardar el anexo' }
    }
}

export async function deleteAnexo(id: string) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_anexos')) {
        return { error: 'No tienes permisos para eliminar anexos' }
    }

    try {
        await prisma.anexo.delete({ where: { id } })
        revalidatePath('/dashboard/ayuda/agregar')
        revalidatePath('/dashboard/ayuda/ver')
        return { success: true }
    } catch (error) {
        return { error: 'Error al eliminar el anexo' }
    }
}

export async function uploadAnexosBulk(data: AnexoData[]) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_anexos')) {
        return { error: 'No tienes permisos para realizar carga masiva' }
    }

    try {
        await prisma.anexo.createMany({
            data: data.map(d => ({
                ...d,
                id: undefined
            }))
        })
        revalidatePath('/dashboard/ayuda/agregar')
        revalidatePath('/dashboard/ayuda/ver')
        return { success: true, count: data.length }
    } catch (error) {
        console.error('Error in bulk upload:', error)
        return { error: 'Error al realizar la carga masiva' }
    }
}

export async function getAllAnexosForExport() {
  const session = await getSession()
  if (!session?.user?.role?.permissions.includes('view_anexos')) {
      throw new Error('No tienes permisos')
  }
  return await prisma.anexo.findMany({ orderBy: { nombre: 'asc' } })
}

export async function deleteAllAnexos() {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_anexos')) {
        return { error: 'No tienes permisos para eliminar anexos' }
    }

    try {
        await prisma.anexo.deleteMany({})
        revalidatePath('/dashboard/ayuda/agregar')
        revalidatePath('/dashboard/ayuda/ver')
        return { success: true }
    } catch (error) {
        return { error: 'Error al vaciar los anexos' }
    }
}
