import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import Sidebar from '@/components/Sidebar'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const session = await getSession()

    if (!session) {
        redirect('/login')
    }

    const userData = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { 
            role: true,
            areas: true,
            sucursales: true
        }
    })

    if (!userData) redirect('/login')

    const user = userData as any

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar Navigation */}
            <Sidebar user={user} />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-h-screen max-w-full overflow-hidden">
                {/* Top Header */}
                <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-8 pl-16 lg:pl-8 shadow-sm z-10">
                    <h1 className="text-xl font-semibold text-gray-800">
                        Aplicaciones Hendaya
                    </h1>
                    <div className="flex items-center gap-4">
                        <div className="hidden sm:block text-sm text-right">
                            <p className="font-medium text-gray-900">{user.name || user.username}</p>
                            <p className="text-gray-500 text-xs">{user.role.name}</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-500 to-sky-600 flex items-center justify-center text-white font-bold shadow-md shadow-cyan-500/20 shrink-0">
                            {user.name ? user.name.charAt(0).toUpperCase() : user.username.charAt(0).toUpperCase()}
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-4 sm:p-8">
                    <div className="max-w-7xl mx-auto min-w-0">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    )
}
