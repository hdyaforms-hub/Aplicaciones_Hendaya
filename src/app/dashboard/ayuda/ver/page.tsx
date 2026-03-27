import { getAnexos } from '../actions'
import VerAnexosClient from './VerAnexosClient'
import { prisma } from '@/lib/prisma'

export default async function VerAnexosPage({
    searchParams
}: {
    searchParams: Promise<{ sucursal?: string, nombre?: string }>
}) {
    const resolvedParams = await searchParams
    const filters = {
        sucursal: resolvedParams.sucursal || '',
        nombre: resolvedParams.nombre || ''
    }

    const anexos = await getAnexos(filters)
    
    // Obtener lista de sucursales únicas para el filtro
    const sucursales = await prisma.anexo.findMany({
        select: { sucursal: true },
        distinct: ['sucursal'],
        orderBy: { sucursal: 'asc' }
    }).then(rows => rows.map(r => r.sucursal))

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <span>📖</span> Ver Anexos
                </h2>
                <p className="text-gray-500 mt-1">Busca información de contacto y anexos rápidamente</p>
            </div>

            <VerAnexosClient 
                initialAnexos={JSON.parse(JSON.stringify(anexos))} 
                sucursales={sucursales}
                initialFilters={filters}
            />
        </div>
    )
}
