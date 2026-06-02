import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import ManipuladorasClientPage from './ManipuladorasClientPage'

export default async function ManipuladorasPage() {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []

    if (!permissions.includes('manage_manipuladoras_masiva')) {
        redirect('/dashboard')
    }

    const users = await prisma.user.findMany({
        where: {
            isDeleted: false,
            role: {
                name: { equals: 'Manipuladoras', mode: 'insensitive' }
            }
        },
        include: { sucursales: true },
        orderBy: { createdAt: 'desc' }
    })

    const sucursales = await prisma.sucursal.findMany({
        orderBy: { nombre: 'asc' }
    })

    // Serializar fechas para pasar al Client Component
    const serializedUsers = users.map(u => ({
        id: u.id,
        username: u.username,
        name: u.name,
        email: u.email,
        isActive: u.isActive,
        isDeleted: u.isDeleted,
        sucursales: u.sucursales.map(s => ({ id: s.id, nombre: s.nombre })),
        rbds: u.rbds,
        createdAt: u.createdAt.toISOString()
    }))

    return (
        <ManipuladorasClientPage users={serializedUsers} sucursales={sucursales} />
    )
}
