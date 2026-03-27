import { getAnexos } from '../actions'
import AnexoMaintainer from './AnexoMaintainer'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'

export default async function AgregarAnexosPage() {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_anexos')) {
        redirect('/dashboard')
    }

    const anexos = await getAnexos()
    
    // Obtener lista de sucursales únicas de la tabla Sucursal (si existe)
    // O de los anexos ya existentes
    const sucursales = await prisma.sucursal.findMany({
        select: { nombre: true },
        orderBy: { nombre: 'asc' }
    }).then(rows => rows.map(r => r.nombre))

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <span>📝</span> Gestión de Anexos
                    </h2>
                    <p className="text-gray-500 mt-1">Agrega, edita o elimina información de contacto</p>
                </div>
            </div>

            <AnexoMaintainer 
                initialAnexos={JSON.parse(JSON.stringify(anexos))} 
                sucursalesList={sucursales}
            />
        </div>
    )
}
