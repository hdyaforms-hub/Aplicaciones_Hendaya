import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import CodigoCausaClient from './CodigoCausaClient'

export default async function CodigoCausaPage() {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []

    if (!permissions.includes('view_codigo_causa')) {
        redirect('/dashboard')
    }

    // Obtener los códigos de causa ordenados de manera ascendente por ID
    const codigos = await prisma.codigoCausa.findMany({
        orderBy: {
            id: 'asc'
        }
    })

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                        <span>⚙️</span> Mantenedor de Códigos de Causa
                    </h2>
                    <p className="text-gray-500 mt-1">Configuración de descripciones asociadas a los códigos de causa de PAE Online</p>
                </div>
            </div>

            {/* Componente Cliente para interactividad del CRUD */}
            <CodigoCausaClient initialData={codigos} />
        </div>
    )
}
