'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

const PATH = '/dashboard/mantenedor/operaciones/vehiculos'

async function hasPermission() {
    const session = await getSession()
    return session?.user?.role?.permissions.includes('manage_vehiculos')
}

export async function getVehiculos() {
    try {
        return await prisma.vehiculo.findMany({
            include: {
                ut: true,
                sucursal: true,
                tipoVehiculo: true,
                licitacion: true
            },
            orderBy: {
                patente: 'asc'
            }
        })
    } catch (e) {
        console.error('Error fetching vehiculos:', e)
        return []
    }
}

export async function getTipoVehiculos() {
    try {
        return await prisma.tipoVehiculo.findMany({
            orderBy: { nombre: 'asc' }
        })
    } catch (e) {
        console.error('Error fetching tipo vehiculos:', e)
        return []
    }
}

export async function getUTs() {
    try {
        return await prisma.uT.findMany({
            where: { estado: 1 },
            include: { sucursal: true, licitacion: true },
            orderBy: { codUT: 'asc' }
        })
    } catch (e) {
        console.error('Error fetching UTs:', e)
        return []
    }
}

export async function getLicitaciones() {
    try {
        return await prisma.licitacion.findMany({
            where: { estado: 1 },
            orderBy: { licId: 'asc' }
        })
    } catch (e) {
        console.error('Error fetching licitaciones:', e)
        return []
    }
}

export async function getSucursales() {
    try {
        return await prisma.sucursal.findMany({
            orderBy: { nombre: 'asc' }
        })
    } catch (e) {
        console.error('Error fetching sucursales:', e)
        return []
    }
}

export async function createVehiculo(data: {
    patente: string
    utId: number | null
    sucursalId: string
    tipoVehiculoId: string
    licId: number | null
    utIds: string | null
    vigente: boolean
}) {
    if (!await hasPermission()) return { error: 'No tienes permisos para esta acción.' }

    const patenteUpper = data.patente.toUpperCase().trim()
    if (!patenteUpper) return { error: 'La patente es requerida.' }

    try {
        const existing = await prisma.vehiculo.findUnique({
            where: { patente: patenteUpper }
        })
        if (existing) return { error: 'Ya existe un vehículo registrado con esta patente.' }

        await prisma.vehiculo.create({
            data: {
                patente: patenteUpper,
                utId: data.utId,
                sucursalId: data.sucursalId,
                tipoVehiculoId: data.tipoVehiculoId,
                licId: data.licId,
                utIds: data.utIds,
                vigente: data.vigente
            }
        })

        revalidatePath(PATH)
        return { success: true }
    } catch (e: any) {
        console.error('Error creating vehiculo:', e)
        return { error: 'Ocurrió un error al guardar el vehículo.' }
    }
}

export async function updateVehiculo(id: string, data: {
    patente: string
    utId: number | null
    sucursalId: string
    tipoVehiculoId: string
    licId: number | null
    utIds: string | null
    vigente: boolean
}) {
    if (!await hasPermission()) return { error: 'No tienes permisos para esta acción.' }

    const patenteUpper = data.patente.toUpperCase().trim()
    if (!patenteUpper) return { error: 'La patente es requerida.' }

    try {
        const existing = await prisma.vehiculo.findFirst({
            where: {
                patente: patenteUpper,
                NOT: { id }
            }
        })
        if (existing) return { error: 'Ya existe otro vehículo registrado con esta patente.' }

        await prisma.vehiculo.update({
            where: { id },
            data: {
                patente: patenteUpper,
                utId: data.utId,
                sucursalId: data.sucursalId,
                tipoVehiculoId: data.tipoVehiculoId,
                licId: data.licId,
                utIds: data.utIds,
                vigente: data.vigente
            }
        })

        revalidatePath(PATH)
        return { success: true }
    } catch (e: any) {
        console.error('Error updating vehiculo:', e)
        return { error: 'Ocurrió un error al actualizar el vehículo.' }
    }
}

export async function deleteVehiculo(id: string) {
    if (!await hasPermission()) return { error: 'No tienes permisos para esta acción.' }

    try {
        // Verificar si el vehículo está asociado a algún supervisor
        const associatedSupervisors = await prisma.supervisorVehiculo.count({
            where: { vehiculoId: id }
        })
        if (associatedSupervisors > 0) {
            return { error: 'No se puede eliminar este vehículo porque está asociado a uno o más supervisores.' }
        }

        await prisma.vehiculo.delete({
            where: { id }
        })

        revalidatePath(PATH)
        return { success: true }
    } catch (e: any) {
        console.error('Error deleting vehiculo:', e)
        return { error: 'Ocurrió un error al eliminar el vehículo.' }
    }
}

export async function createTipoVehiculo(nombre: string) {
    if (!await hasPermission()) return { error: 'No tienes permisos para esta acción.' }

    const nombreClean = nombre.trim()
    if (!nombreClean) return { error: 'El nombre es obligatorio.' }

    try {
        const existing = await prisma.tipoVehiculo.findUnique({
            where: { nombre: nombreClean }
        })
        if (existing) return { error: 'Ya existe este tipo de vehículo.' }

        const result = await prisma.tipoVehiculo.create({
            data: { nombre: nombreClean }
        })

        revalidatePath(PATH)
        return { success: true, data: result }
    } catch (e: any) {
        console.error('Error creating tipo vehiculo:', e)
        return { error: 'Ocurrió un error al registrar el tipo de vehículo.' }
    }
}
