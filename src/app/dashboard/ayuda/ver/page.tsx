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
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
            <VerAnexosClient 
                initialAnexos={JSON.parse(JSON.stringify(anexos))} 
                sucursales={sucursales}
                initialFilters={filters}
            />
        </div>
    )
}
