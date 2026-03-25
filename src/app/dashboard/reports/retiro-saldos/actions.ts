
'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

export async function searchColegiosRetiroReport(query: string) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_retiro_report')) {
        return { error: 'No tienes permisos para buscar' }
    }

    if (!query || query.trim() === '') {
        return { colegios: [] }
    }

    const isNumeric = !isNaN(Number(query))

    try {
        const dbUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { sucursales: true }
        })
        const userSucursales = dbUser?.sucursales.map(s => s.nombre) || []
        const isAdmin = session.user.role.name === 'Administrador'

        let whereClause: any = {}
        if (!isAdmin) {
            // Filter by user sucursales via UT relationship if possible, 
            // but here we can just check if the sucursal matches.
            // Actually, Colegios has a 'sucursal' field directly.
            whereClause.sucursal = { in: userSucursales }
        }

        const colegios = await prisma.colegios.findMany({
            where: {
                ...whereClause,
                OR: [
                    ...(isNumeric ? [{ colRBD: Number(query) }] : []),
                    { nombreEstablecimiento: { contains: query } }
                ]
            },
            take: 10
        })

        return { colegios }
    } catch (e) {
        console.error("Error searching colegios retiro report:", e)
        return { error: 'Error en la búsqueda' }
    }
}

export async function getRetiroReport(filters: {
    fechaDesde?: string
    fechaHasta?: string
    rbd?: number
    sucursal?: string
}) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_retiro_report')) {
        return { error: 'No tienes permisos para ver el reporte' }
    }

    try {
        const dbUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { sucursales: true }
        })
        const userSucursales = dbUser?.sucursales.map(s => s.nombre) || []
        const isAdmin = session.user.role.name === 'Administrador'

        let where: any = {}

        if (filters.fechaDesde || filters.fechaHasta) {
            where.fecha = {}
            if (filters.fechaDesde) {
                where.fecha.gte = new Date(new Date(filters.fechaDesde).setHours(0, 0, 0, 0));
            }
            if (filters.fechaHasta) {
                where.fecha.lte = new Date(new Date(filters.fechaHasta).setHours(23, 59, 59, 999));
            }
        }

        if (filters.rbd) {
            where.rbd = Number(filters.rbd)
        }

        if (filters.sucursal) {
            where.sucursal = filters.sucursal
        } else if (!isAdmin) {
            where.sucursal = { in: userSucursales }
        }

        const registros = await prisma.retiroSaldoHeader.findMany({
            where,
            include: { detalles: true },
            orderBy: { fecha: 'desc' }
        })

        // Format for frontend (flattening details might be needed for Excel)
        return { 
            registros, 
            userSucursales,
            isAdmin
        }
    } catch (e) {
        console.error("Error fetching retiro report:", e)
        return { error: 'Error al obtener los registros del reporte' }
    }
}
