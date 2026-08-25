import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import UsersClient from './UsersClient'

export default async function UsersPage() {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []

    if (!permissions.includes('manage_users')) {
        redirect('/dashboard')
    }

    const users = await prisma.user.findMany({
        where: {
            isDeleted: false,
            role: {
                name: { not: 'Manipuladoras' }
            }
        },
        include: { role: true, sucursales: true, areas: true, licitaciones: true },
        orderBy: { createdAt: 'desc' }
    })

    const roles = await prisma.role.findMany({
        orderBy: { name: 'asc' }
    })

    const sucursales = await prisma.sucursal.findMany({
        orderBy: { nombre: 'asc' }
    })

    const areas = await prisma.area.findMany({
        where: { isActive: true },
        orderBy: { nombre: 'asc' }
    })

    const licitaciones = await prisma.licitacion.findMany({
        orderBy: { licId: 'asc' }
    })

    return (
        <UsersClient 
            initialUsers={users as any} 
            roles={roles} 
            sucursales={sucursales} 
            areas={areas} 
            licitaciones={licitaciones}
        />
    )
}
