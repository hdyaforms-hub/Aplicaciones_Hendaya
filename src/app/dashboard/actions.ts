'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'

export async function createUser(formData: FormData) {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []

    if (!permissions.includes('manage_users')) {
        return { error: 'No tienes permisos para crear usuarios' }
    }

    const username = formData.get('username') as string
    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const roleId = formData.get('roleId') as string
    const isActive = formData.get('isActive') !== 'false'
    const sucursales = formData.getAll('sucursales') as string[]
    const areas = formData.getAll('areas') as string[]

    if (!username || !password || !roleId) {
        return { error: 'Faltan campos obligatorios' }
    }

    try {
        const existing = await prisma.user.findUnique({ where: { username } })
        if (existing) return { error: 'El nombre de usuario ya existe' }

        if (email) {
            const existingEmail = await prisma.user.findUnique({ where: { email } })
            if (existingEmail) return { error: 'El correo electrónico ya está en uso' }
        }

        const passwordHash = await bcrypt.hash(password, 10)

        await prisma.user.create({
            data: {
                username,
                name,
                email: email || null,
                passwordHash,
                roleId,
                isActive,
                sucursales: {
                    connect: sucursales.map(id => ({ id }))
                },
                areas: {
                    connect: areas.map(id => ({ id: parseInt(id, 10) }))
                }
            }
        })

        revalidatePath('/dashboard/users')
        return { success: true }
    } catch (error) {
        console.error('Error creating user:', error)
        return { error: 'Fallo al crear el usuario en la base de datos' }
    }
}

export async function updateUser(formData: FormData) {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []

    if (!permissions.includes('manage_users')) {
        return { error: 'No tienes permisos para editar usuarios' }
    }

    const id = formData.get('id') as string
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const roleId = formData.get('roleId') as string
    const isActive = formData.get('isActive') !== 'false'
    const sucursales = formData.getAll('sucursales') as string[]
    const areas = formData.getAll('areas') as string[]

    if (!id) return { error: 'ID de usuario no proporcionado' }

    try {
        const existingId = await prisma.user.findUnique({ where: { id } })
        if (!existingId) return { error: 'El usuario no existe' }

        if (email) {
            const existingEmail = await prisma.user.findUnique({ where: { email } })
            if (existingEmail && existingEmail.id !== id) return { error: 'El correo electrónico ya está en uso por otro usuario' }
        }

        const dataToUpdate: any = {
            email: email || null,
            roleId,
            isActive,
            sucursales: {
                set: [], // Clear existing
                connect: sucursales.map(sId => ({ id: sId }))
            },
            areas: {
                set: [],
                connect: areas.map(aId => ({ id: parseInt(aId, 10) }))
            }
        }

        if (password) {
            dataToUpdate.passwordHash = await bcrypt.hash(password, 10)
        }

        await prisma.user.update({
            where: { id },
            data: dataToUpdate
        })

        revalidatePath('/dashboard/users')
        return { success: true }
    } catch (error) {
        console.error('Error updating user:', error)
        return { error: 'Fallo al actualizar el usuario en la base de datos' }
    }
}

export async function createRole(formData: FormData) {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []

    if (!permissions.includes('manage_roles')) {
        return { error: 'No tienes permisos para crear roles' }
    }

    const name = formData.get('name') as string
    const description = formData.get('description') as string

    // Collect multiple permission checkbox values
    const perms = formData.getAll('permissions') as string[]

    if (!name) return { error: 'El nombre del rol es obligatorio' }

    try {
        const existing = await prisma.role.findUnique({ where: { name } })
        if (existing) return { error: 'El nombre del rol ya existe' }

        await prisma.role.create({
            data: {
                name,
                description,
                permissions: JSON.stringify(perms),
            }
        })

        revalidatePath('/dashboard/roles')
        return { success: true }
    } catch (error) {
        console.error('Error creating role:', error)
        return { error: 'Fallo al crear el rol en la base de datos' }
    }
}

export async function updateRole(formData: FormData) {
    const session = await getSession()
    const sessionPermissions = session?.user?.role?.permissions || []

    if (!sessionPermissions.includes('manage_roles')) {
        return { error: 'No tienes permisos para editar roles' }
    }

    const id = formData.get('id') as string
    const name = formData.get('name') as string
    const description = formData.get('description') as string
    const perms = formData.getAll('permissions') as string[]

    if (!id || !name) return { error: 'El ID y nombre del rol son obligatorios' }

    try {
        const existingId = await prisma.role.findUnique({ where: { id } })
        if (!existingId) return { error: 'El rol no existe' }

        const existingName = await prisma.role.findUnique({ where: { name } })
        if (existingName && existingName.id !== id) return { error: 'El nombre del rol ya está en uso' }

        await prisma.role.update({
            where: { id },
            data: {
                name,
                description,
                permissions: JSON.stringify(perms),
            }
        })

        revalidatePath('/dashboard/roles')
        return { success: true }
    } catch (error) {
        console.error('Error updating role:', error)
        return { error: 'Fallo al actualizar el rol en la base de datos' }
    }
}
