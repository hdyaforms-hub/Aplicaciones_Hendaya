'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'

export async function searchRBDs(query: string, sucursalIds: string[]) {
    if (!query || query.length < 2) return []

    // Obtener nombres de las sucursales permitidas
    const sucursales = await prisma.sucursal.findMany({
        where: { id: { in: sucursalIds } },
        select: { nombre: true }
    })
    const sucursalNames = sucursales.map(s => s.nombre)

    // Si la query es numérica, intentamos buscar por RBD
    const queryAsNumber = parseInt(query, 10)
    const OR_condition: any[] = [
        { nombreEstablecimiento: { contains: query, mode: 'insensitive' } }
    ]

    if (!isNaN(queryAsNumber)) {
        OR_condition.push({ colRBD: queryAsNumber })
    }

    const colegios = await prisma.colegios.findMany({
        where: {
            sucursal: { in: sucursalNames },
            OR: OR_condition
        },
        take: 20,
        select: {
            colRBD: true,
            nombreEstablecimiento: true,
            comuna: true,
            sucursal: true
        }
    })

    // Eliminar duplicados si los hay (por colRBD)
    const unique = colegios.filter((value, index, self) =>
        index === self.findIndex((t) => (
            t.colRBD === value.colRBD
        ))
    )

    return unique
}

export async function createManipuladora(formData: FormData) {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []
    if (!permissions.includes('manage_manipuladoras_masiva')) {
        return { error: 'No tienes permisos' }
    }

    const username = formData.get('username') as string
    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const isActive = formData.get('isActive') !== 'false'
    const sucursales = formData.getAll('sucursales') as string[]
    const rbds = formData.getAll('rbds').map(r => parseInt(r as string, 10)).filter(r => !isNaN(r))

    if (!username || !password || sucursales.length === 0) {
        return { error: 'Faltan campos obligatorios' }
    }

    try {
        const existing = await prisma.user.findUnique({ where: { username } })
        if (existing) return { error: 'El nombre de usuario ya existe' }

        // Buscar el rol y área "Manipuladoras"
        const rolManipuladora = await prisma.role.findFirst({
            where: { name: { equals: 'Manipuladoras', mode: 'insensitive' } }
        })
        const areaManipuladora = await prisma.area.findFirst({
            where: { nombre: { equals: 'MANIPULADORAS', mode: 'insensitive' } }
        })

        if (!rolManipuladora || !areaManipuladora) {
            return { error: 'El rol "Manipuladoras" o área "MANIPULADORAS" no están configurados en el sistema' }
        }

        const passwordHash = await bcrypt.hash(password, 10)

        await prisma.user.create({
            data: {
                username,
                name,
                email: email || null,
                passwordHash,
                roleId: rolManipuladora.id,
                isActive,
                mustChangePassword: true,
                rbds,
                sucursales: {
                    connect: sucursales.map(id => ({ id }))
                },
                areas: {
                    connect: { id: areaManipuladora.id }
                }
            }
        })

        revalidatePath('/dashboard/mantenedor/manipuladoras')
        return { success: true }
    } catch (error) {
        console.error('Error creating manipuladora:', error)
        return { error: 'Fallo al crear la manipuladora' }
    }
}

export async function updateManipuladora(formData: FormData) {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []
    if (!permissions.includes('manage_manipuladoras_masiva')) {
        return { error: 'No tienes permisos' }
    }

    const id = formData.get('id') as string
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const isActive = formData.get('isActive') !== 'false'
    const resetPassword = formData.get('resetPassword') === 'on'
    const sucursales = formData.getAll('sucursales') as string[]
    const rbds = formData.getAll('rbds').map(r => parseInt(r as string, 10)).filter(r => !isNaN(r))

    if (!id) return { error: 'ID de usuario no proporcionado' }

    try {
        const dataToUpdate: any = {
            email: email || null,
            isActive,
            rbds,
            sucursales: {
                set: [],
                connect: sucursales.map(sId => ({ id: sId }))
            }
        }

        if (resetPassword) {
            dataToUpdate.passwordHash = await bcrypt.hash('Henda.2026$', 10)
            dataToUpdate.mustChangePassword = true
        } else if (password) {
            dataToUpdate.passwordHash = await bcrypt.hash(password, 10)
            dataToUpdate.mustChangePassword = false
        }

        await prisma.user.update({
            where: { id },
            data: dataToUpdate
        })

        revalidatePath('/dashboard/mantenedor/manipuladoras')
        return { success: true }
    } catch (error) {
        console.error('Error updating manipuladora:', error)
        return { error: 'Fallo al actualizar la manipuladora' }
    }
}

export async function deleteManipuladora(id: string) {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []
    if (!permissions.includes('manage_manipuladoras_masiva')) {
        return { error: 'No tienes permisos' }
    }

    try {
        await prisma.user.update({
            where: { id },
            data: { isDeleted: true }
        })
        revalidatePath('/dashboard/mantenedor/manipuladoras')
        return { success: true }
    } catch (error) {
        return { error: 'Fallo al eliminar' }
    }
}
