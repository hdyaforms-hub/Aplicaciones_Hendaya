import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import LlenarActaClient from './LlenarActaClient'

export const dynamic = 'force-dynamic'

export default async function LlenarActaPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params
    const session = await getSession()
    if (!session) redirect('/login')

    if (!resolvedParams?.id) {
        return (
            <div className="p-8 text-center bg-white rounded-3xl m-8">
                <span className="text-5xl block mb-4">🔍</span>
                <h2 className="text-2xl font-black mb-2">ID de Acta inválido</h2>
            </div>
        )
    }

    const actaRespuesta = await (prisma as any).actaSupervisionRespuesta.findUnique({
        where: { id: resolvedParams.id },
        include: {
            plantilla: true
        }
    })

    if (!actaRespuesta) {
        return (
            <div className="p-8 text-center bg-white rounded-3xl m-8">
                <span className="text-5xl block mb-4">🔍</span>
                <h2 className="text-2xl font-black mb-2">Acta no encontrada</h2>
            </div>
        )
    }

    if (!actaRespuesta.correlativo && actaRespuesta.plantillaId) {
        const countEarlier = await (prisma as any).actaSupervisionRespuesta.count({
            where: {
                plantillaId: actaRespuesta.plantillaId,
                createdAt: { lte: actaRespuesta.createdAt }
            }
        })
        const corrVal = countEarlier > 0 ? countEarlier : 1
        actaRespuesta.correlativo = corrVal
        await (prisma as any).actaSupervisionRespuesta.update({
            where: { id: actaRespuesta.id },
            data: { correlativo: corrVal }
        }).catch(() => {})
    }

    return (
        <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
            <LlenarActaClient 
                initialActa={actaRespuesta} 
                plantilla={actaRespuesta.plantilla}
            />
        </main>
    )
}
