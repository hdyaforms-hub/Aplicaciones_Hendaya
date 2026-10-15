import { prisma, rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import ListaCorreoWrapper from './ListaCorreoWrapper'
import { ensureNotificationConditionalColumns } from '@/lib/notifications-db-init'

export default async function ListasCorreoPage() {
    const session = await getSession()
    const permissions = session?.user?.role?.permissions || []
    const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'

    if (!isAdmin && !permissions.includes('manage_listas')) {
        redirect('/dashboard')
    }

    await ensureNotificationConditionalColumns()

    const rawListas: any[] = await rawPrisma.$queryRawUnsafe(`
        SELECT lc.id, lc.nombre, lc.descripcion, lc.para, lc.cc, lc."sucursalId", lc."porSucursal", lc."updatedAt",
               s.id as "suc_id", s.nombre as "suc_nombre"
        FROM "ListaCorreo" lc
        LEFT JOIN "Sucursal" s ON s.id = lc."sucursalId"
        ORDER BY lc.nombre ASC;
    `)

    const listas = rawListas.map(r => ({
        id: r.id,
        nombre: r.nombre,
        descripcion: r.descripcion,
        para: r.para,
        cc: r.cc,
        sucursalId: r.sucursalId,
        porSucursal: r.porSucursal,
        updatedAt: r.updatedAt,
        sucursal: r.suc_id ? { id: r.suc_id, nombre: r.suc_nombre } : null
    }))

    const sucursales = await prisma.sucursal.findMany({
        orderBy: { nombre: 'asc' }
    })

    return (
        <ListaCorreoWrapper listas={listas} sucursales={sucursales} />
    )
}
