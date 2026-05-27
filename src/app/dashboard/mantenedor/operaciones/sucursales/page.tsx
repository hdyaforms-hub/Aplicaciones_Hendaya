import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import SucursalesDashboard from './SucursalesDashboard'

export default async function SucursalesConfigPage() {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []

    if (!permissions.includes('manage_sucursales')) {
        redirect('/dashboard')
    }

    const licitaciones = await prisma.licitacion.findMany({
        orderBy: { licId: 'asc' }
    })

    const uts = await prisma.uT.findMany({
        orderBy: { codUT: 'asc' },
        include: { licitacion: true, sucursal: true }
    })

    const sucursales = await prisma.sucursal.findMany({
        orderBy: { nombre: 'asc' },
        include: { uts: true }
    })

    return (
        <SucursalesDashboard
            licitaciones={licitaciones}
            uts={uts}
            sucursales={sucursales}
        />
    )
}
