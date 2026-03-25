
'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

export async function getSolicitudesReport(filters: {
    fechaDesde?: string,
    fechaHasta?: string,
    rbd?: number,
    sucursal?: string
}) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_solicitud_pan_report')) {
        return { error: 'No tienes permisos para consultar esta información' }
    }

    try {
        const dbUser = await (prisma.user as any).findUnique({
            where: { id: session?.user?.id as string },
            include: { sucursales: true }
        })
        const userSucursalNames = dbUser?.sucursales?.map((s: any) => s.nombre) || []

        const uts = await prisma.uT.findMany({
            where: { sucursal: { nombre: { in: userSucursalNames } } },
            select: { codUT: true }
        })
        const allowedUTs = uts.map(ut => ut.codUT)

        const where: any = {
            ut: { in: allowedUTs }
        }

        if (filters.fechaDesde || filters.fechaHasta) {
            where.fechaSolicitud = {}
            if (filters.fechaDesde) {
                where.fechaSolicitud.gte = new Date(`${filters.fechaDesde}T00:00:00Z`);
            }
            if (filters.fechaHasta) {
                where.fechaSolicitud.lte = new Date(`${filters.fechaHasta}T23:59:59Z`);
            }
        }

        if (filters.rbd) {
            where.rbd = filters.rbd
        }

        const registrosRaw = await prisma.solicitudPan.findMany({
            where,
            orderBy: {
                fechaSolicitud: 'desc'
            }
        })

        // Enriquecer registros
        const enriched = await Promise.all(registrosRaw.map(async (reg) => {
            const colegio = await prisma.colegios.findFirst({
                where: { colRBD: reg.rbd, colut: reg.ut }
            })
            
            const utInfo = await prisma.uT.findUnique({
                where: { codUT: reg.ut },
                include: { sucursal: true }
            })

            return {
                ...reg,
                nombreEstablecimiento: colegio?.nombreEstablecimiento || 'N/A',
                sucursal: utInfo?.sucursal?.nombre || 'N/A'
            }
        }))

        let finalResult = enriched;
        if (filters.sucursal) {
            finalResult = enriched.filter(r => r.sucursal === filters.sucursal);
        }

        return { registros: finalResult, userSucursales: userSucursalNames }
    } catch (e) {
        console.error("Error fetching Solicitudes Report:", e)
        return { error: 'Ocurrió un error al cargar el informe.' }
    }
}

export async function searchColegiosReport(query: string) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_solicitud_pan_report')) {
        return { error: 'No tienes permisos para buscar colegios' }
    }

    if (!query || query.trim() === '') {
        return { colegios: [] }
    }

    const isNumeric = !isNaN(Number(query))
    const isAdmin = session?.user?.role?.name === 'Administrador'

    try {
        const dbUser = await (prisma.user as any).findUnique({
            where: { id: session?.user?.id as string },
            include: { sucursales: true }
        })
        const userSucursalNames = dbUser?.sucursales?.map((s: any) => s.nombre) || []

        const uts = await prisma.uT.findMany({
            where: { sucursal: { nombre: { in: userSucursalNames } } },
            select: { codUT: true }
        })
        const allowedUTs = uts.map(ut => ut.codUT)

        const baseWhere: any = {
            OR: [
                ...(isNumeric ? [{ colRBD: Number(query) }] : []),
                { nombreEstablecimiento: { contains: query } }
            ]
        }

        const finalWhere = isAdmin ? baseWhere : {
            ...baseWhere,
            colut: { in: allowedUTs }
        }

        const colegios = await prisma.colegios.findMany({
            where: finalWhere,
            take: 10,
            orderBy: { nombreEstablecimiento: 'asc' }
        })

        return { colegios }
    } catch (e) {
        console.error("Error searching colegios for report:", e)
        return { error: 'Error al buscar' }
    }
}
