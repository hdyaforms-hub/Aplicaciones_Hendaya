import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import UserForm from './UserForm'

import EditUserForm from './EditUserForm'

export default async function UsersPage() {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []

    if (!permissions.includes('manage_users')) {
        redirect('/dashboard')
    }

    const users = await prisma.user.findMany({
        include: { role: true, sucursales: true, areas: true },
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

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <span>👥</span> Gestión de Usuarios
                    </h2>
                    <p className="text-gray-500 mt-1">Administra las cuentas y accesos al sistema</p>
                </div>

                <UserForm roles={roles} sucursales={sucursales} areas={areas} />
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 text-slate-600 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Usuario</th>
                                <th className="px-6 py-4 font-semibold">Nombre</th>
                                <th className="px-6 py-4 font-semibold">Estado</th>
                                <th className="px-6 py-4 font-semibold">Rol</th>
                                <th className="px-6 py-4 font-semibold">Sucursales</th>
                                <th className="px-6 py-4 font-semibold">Creado</th>
                                <th className="px-6 py-4 font-semibold text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-700">
                            {users.map((u) => (
                                <tr key={u.id} className="hover:bg-cyan-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900">{u.username}</div>
                                        <div className="text-xs text-gray-400">{u.email || 'Sin correo'}</div>
                                    </td>
                                    <td className="px-6 py-4">{u.name || '-'}</td>
                                    <td className="px-6 py-4">
                                        {u.isActive ? (
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                Vigente
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-rose-100 text-rose-800 border border-rose-200">
                                                No Vigente
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-cyan-100 text-cyan-800 border border-cyan-200">
                                            {u.role.name}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="max-w-[200px] truncate text-gray-500" title={u.sucursales.map(s => s.nombre).join(', ')}>
                                            {u.sucursales.length > 0 ? u.sucursales.map(s => s.nombre).join(', ') : 'Ninguna'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500">
                                        {new Date(u.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <EditUserForm user={u as any} roles={roles} sucursales={sucursales} areas={areas} />
                                    </td>
                                </tr>
                            ))}

                            {users.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                        No se encontraron usuarios registrados
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
