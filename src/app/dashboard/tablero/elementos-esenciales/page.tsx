import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function ElementosEsencialesDashboardPage() {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_tablero_elementos')) {
        redirect('/dashboard')
    }

    // Fetch initial data for filters
    const allRecords = await prisma.elementosEsenciales_Cab.findMany({
        select: {
            licitacion: true,
            region: true,
            fechaSupervision: true
        }
    })

    const availableLicitaciones = Array.from(new Set(allRecords.map(r => r.licitacion).filter(Boolean))) as string[]
    const availableRegions = Array.from(new Set(allRecords.map(r => r.region).filter(Boolean))) as string[]
    const availableAnos = Array.from(new Set(allRecords.map(r => r.fechaSupervision?.getFullYear()).filter(Boolean))) as number[]

    return (
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <span>📊</span> Tablero Elementos Esenciales
                    </h2>
                    <p className="text-gray-500 mt-1">
                        Análisis de cumplimiento y tendencias de supervisión
                    </p>
                </div>
            </div>

            <DashboardClient 
                availableLicitaciones={availableLicitaciones.sort()}
                availableRegions={availableRegions.sort()}
                availableAnos={availableAnos.sort((a, b) => b - a)}
            />
        </div>
    )
}
