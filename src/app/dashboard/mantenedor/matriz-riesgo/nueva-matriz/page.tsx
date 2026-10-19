import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getLicitaciones, getMatrices } from './actions'
import NuevaMatrizDashboard from './NuevaMatrizDashboard'

export default async function NuevaMatrizPage() {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('manage_nueva_matriz')) {
        redirect('/dashboard')
    }

    const [{ licitaciones }, { matrices }, rolesDb] = await Promise.all([
        getLicitaciones(),
        getMatrices(),
        prisma.role.findMany({
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        })
    ])

    return (
        <NuevaMatrizDashboard
            initialLicitaciones={licitaciones || []}
            initialMatrices={(matrices as any) || []}
            availableRoles={rolesDb || []}
        />
    )
}

