import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import CrearFormularioClient from './CrearFormularioClient'

export default async function CrearFormularioPage() {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('create_formularios')) {
        redirect('/dashboard')
    }

    const areas = await prisma.area.findMany({
        where: { isActive: true },
        orderBy: { nombre: 'asc' }
    })

    return (
        <div className="space-y-6">
            <CrearFormularioClient areas={areas} />
        </div>
    )
}
