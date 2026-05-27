import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import AreaClient from './AreaClient'

export const dynamic = 'force-dynamic'

export default async function AreaConfigPage() {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []

    if (!permissions.includes('manage_areas')) {
        redirect('/dashboard')
    }

    const areas = await prisma.area.findMany({
        orderBy: { nombre: 'asc' }
    })

    return (
        <AreaClient initialAreas={areas} />
    )
}
