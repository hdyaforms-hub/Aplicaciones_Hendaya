import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export default async function DashboardPage() {
    const session = await getSession()
    const user = session?.user

    const usuariosActivos = await prisma.user.count({ where: { isActive: true } })
    const totalRoles = await prisma.role.count()
    const totalEstablecimientos = await prisma.colegios.count()

    return (
        <div className="space-y-6">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
                {/* Background Decoration */}
                <div className="absolute -right-20 -top-20 w-64 h-64 bg-gradient-to-br from-cyan-50 to-sky-50 rounded-full blur-3xl opacity-50" />

                <div className="relative z-10">
                    <h2 className="text-3xl font-bold text-gray-800 tracking-tight">
                        Hola, <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-sky-600">{user?.name || user?.username}</span> 👋
                    </h2>
                    <p className="mt-2 text-gray-500 text-lg">
                        Bienvenido al panel central de tu portal web. Tienes acceso nivel <strong className="text-cyan-600 bg-cyan-50 px-2 py-1 rounded">{user?.role?.name}</strong>.
                    </p>
                </div>
            </div>

            {/* Stats Cards Example */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { title: 'Usuarios Activos', value: usuariosActivos.toString(), icon: '👥', color: 'bg-cyan-50 text-cyan-600' },
                    { title: 'Roles Creados', value: totalRoles.toString(), icon: '🛡️', color: 'bg-sky-50 text-sky-600' },
                    { title: 'Total Establecimientos', value: totalEstablecimientos.toLocaleString(), icon: '🏫', color: 'bg-indigo-50 text-indigo-600' },
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-shadow cursor-pointer">
                        <div>
                            <p className="text-sm font-medium text-gray-500 mb-1">{stat.title}</p>
                            <h3 className="text-3xl font-bold text-gray-900 group-hover:text-cyan-600 transition-colors">{stat.value}</h3>
                        </div>
                        <div className={`w-14 h-14 rounded-2xl ${stat.color} flex items-center justify-center text-3xl shadow-inner`}>
                            {stat.icon}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
