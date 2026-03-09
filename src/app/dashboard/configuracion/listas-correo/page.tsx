import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import ListaCorreoWrapper from './ListaCorreoWrapper'

export default async function ListasCorreoPage() {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []

    if (!permissions.includes('manage_listas')) {
        redirect('/dashboard')
    }

    const listas = await prisma.listaCorreo.findMany({
        orderBy: { nombre: 'asc' },
        include: { sucursal: true }
    })

    const sucursales = await prisma.sucursal.findMany({
        orderBy: { nombre: 'asc' }
    })

    return (
        <ListaCorreoWrapper listas={listas} sucursales={sucursales} />
    )
}
