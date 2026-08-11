import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { logAuditAction } from '@/lib/audit'
import DescargarActasClient from './DescargarActasClient'

export const dynamic = 'force-dynamic'

export default async function DescargarActasPage() {
    const session = await getSession()
    if (!session) redirect('/login')

    const permissions = session?.user?.role?.permissions || []
    const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'

    if (!isAdmin && !permissions.includes('view_descargar_actas')) {
        return (
            <div className="p-8 text-center bg-white rounded-3xl shadow-sm border border-rose-100 m-8">
                <span className="text-5xl block mb-4">⛔</span>
                <h2 className="text-2xl font-black text-rose-600 mb-2">Acceso Denegado</h2>
                <p className="text-gray-500">No tienes los permisos necesarios para acceder a esta sección.</p>
            </div>
        )
    }

    // Registrar en auditoría el acceso a este módulo
    await logAuditAction({
        username: session.user?.username || 'desconocido',
        userId: session.user?.id || null,
        action: 'ACCESO_DESCARGAR_ACTAS',
        modulo: 'ACTAS -> DESCARGAR ACTAS',
        detalle: 'Acceso a la vista de consulta y descarga masiva de actas'
    })

    // En "Descargar Actas", todos los usuarios con permiso pueden ver las actas de TODOS los usuarios
    const respuestasRaw = await (prisma as any).actaSupervisionRespuesta.findMany({
        include: {
            plantilla: true
        },
        orderBy: {
            createdAt: 'desc'
        }
    })

    const colegios = await (prisma as any).colegios.findMany({
        select: { colRBD: true, sucursal: true }
    })
    const colegiosMap = new Map(colegios.map((c: any) => [c.colRBD, c.sucursal]))

    const respuestas = respuestasRaw.map((r: any) => ({
        ...r,
        sucursal: r.sucursal || colegiosMap.get(r.rbd) || null
    }))

    const plantillas = await (prisma as any).actaSupervisionPlantilla.findMany({
        orderBy: { createdAt: 'desc' }
    })

    return (
        <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                            <span>📥</span> Descargar Actas
                        </h1>
                        <p className="text-sm text-slate-500 mt-1 font-medium">
                            Consulta, filtra y descarga individual o masivamente en ZIP los documentos PDF de actas
                        </p>
                    </div>
                </div>

                <DescargarActasClient
                    initialRespuestas={respuestas}
                    plantillas={plantillas}
                    isAdmin={isAdmin}
                />
            </div>
        </main>
    )
}
