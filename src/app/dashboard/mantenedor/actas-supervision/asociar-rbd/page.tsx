import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import AsociarRbdClient from './AsociarRbdClient'

export const dynamic = 'force-dynamic'

export default async function AsociarRbdPage() {
    const session = await getSession()
    if (!session) redirect('/login')

    const permissions = session?.user?.role?.permissions || []
    const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'

    if (!isAdmin && !permissions.includes('manage_user_rbds') && !permissions.includes('manage_actas_supervision')) {
        return (
            <div className="p-8 text-center bg-white rounded-3xl shadow-sm border border-rose-100 m-8">
                <span className="text-5xl block mb-4">⛔</span>
                <h2 className="text-2xl font-black text-rose-600 mb-2">Acceso Denegado</h2>
                <p className="text-gray-500">No tienes los permisos necesarios para acceder a esta sección.</p>
            </div>
        )
    }

    // Cargar todos los usuarios que no estén eliminados
    const users = await prisma.user.findMany({
        where: {
            isDeleted: false,
        },
        include: {
            role: true,
            sucursales: true
        },
        orderBy: {
            name: 'asc'
        }
    })

    // Cargar todos los roles para la agrupación
    const roles = await prisma.role.findMany({
        orderBy: {
            name: 'asc'
        }
    })

    // Cargar listado de colegios para resolver nombres de RBDs
    const colegios = await prisma.colegios.findMany({
        select: {
            colRBD: true,
            nombreEstablecimiento: true,
            sucursal: true,
            institucion: true
        },
        orderBy: {
            colRBD: 'asc'
        }
    })

    return (
        <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <AsociarRbdClient 
                    initialUsers={users as any}
                    roles={roles as any}
                    colegios={colegios}
                />
            </div>
        </main>
    )
}
