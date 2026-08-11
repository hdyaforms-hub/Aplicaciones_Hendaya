import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import GenerarActaClient from './GenerarActaClient'

export const dynamic = 'force-dynamic'

export default async function GenerarActaPage() {
    const session = await getSession()
    if (!session) redirect('/login')

    const permissions = session?.user?.role?.permissions || []
    const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'

    if (!isAdmin && !permissions.includes('view_generar_actas')) {
        return (
            <div className="p-8 text-center bg-white rounded-3xl shadow-sm border border-rose-100 m-8">
                <span className="text-5xl block mb-4">⛔</span>
                <h2 className="text-2xl font-black text-rose-600 mb-2">Acceso Denegado</h2>
                <p className="text-gray-500">No tienes los permisos necesarios para acceder a esta sección.</p>
            </div>
        )
    }

    const username = session.user?.username || ''
    const userRoleName = session?.user?.role?.name || ''
    const userRoleId = session?.user?.role?.id || ''

    const isRoleAllowed = (rolesPerfilesJson: string | null | undefined) => {
        if (!rolesPerfilesJson) return true
        try {
            const allowed: string[] = JSON.parse(rolesPerfilesJson)
            if (!Array.isArray(allowed) || allowed.length === 0) return true
            return allowed.includes(userRoleName) || allowed.includes(userRoleId)
        } catch {
            return true
        }
    }

    // Si no es administrador, solo se muestran las actas creadas por el usuario conectado
    const whereClause: any = {}
    if (!isAdmin) {
        whereClause.usuario = username
    }

    // Cargar las respuestas (actas generadas)
    const allRespuestas = await (prisma as any).actaSupervisionRespuesta.findMany({
        where: whereClause,
        include: {
            plantilla: true
        },
        orderBy: {
            createdAt: 'desc'
        }
    })

    const respuestas = allRespuestas.filter((r: any) => !r.plantilla || isRoleAllowed(r.plantilla.rolesPerfiles))

    // Cargar plantillas activas para el modal de "Nueva Acta" filtradas por rol
    const allPlantillas = await (prisma as any).actaSupervisionPlantilla.findMany({
        where: { estado: true },
        orderBy: { createdAt: 'desc' }
    })

    const plantillas = allPlantillas.filter((p: any) => isRoleAllowed(p.rolesPerfiles))

    return (
        <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                            <span>📝</span> Generar Acta
                        </h1>
                        <p className="text-sm text-slate-500 mt-1 font-medium">
                            Completa actas de supervisión en terreno o retoma borradores
                        </p>
                    </div>
                </div>

                <GenerarActaClient 
                    initialRespuestas={respuestas} 
                    plantillas={plantillas} 
                    isAdmin={isAdmin}
                />
            </div>
        </main>
    )
}
