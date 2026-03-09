'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

export async function getCargaRaciones(ano?: number, mes?: number, rbd?: number) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_reports')) {
        return { error: 'No tienes permisos para consultar esta información' }
    }

    try {
        const filters: any = {}
        if (ano) filters.ano = ano
        if (mes) filters.mes = mes

        const dbUser = await (prisma.user as any).findUnique({
            where: { id: session?.user?.id as string },
            include: { sucursales: true }
        })
        const userSucursales = dbUser?.sucursales?.map((s: any) => s.nombre) || []

        const uts = await prisma.uT.findMany({
            where: { sucursal: { nombre: { in: userSucursales } } },
            select: { codUT: true }
        })
        const allowedUTs = uts.map(ut => ut.codUT)

        const allowedColegios = await prisma.colegios.findMany({
            where: { colut: { in: allowedUTs } },
            select: { colRBD: true }
        })
        const allowedRBDs = allowedColegios.map((c: any) => c.colRBD)

        if (rbd) {
            if (!allowedRBDs.includes(rbd)) {
                return { error: 'No tienes acceso a este RBD' }
            }
            filters.rbd = rbd
        } else {
            filters.rbd = { in: allowedRBDs }
        }

        const registros = await prisma.ingRacion.findMany({
            where: filters,
            orderBy: [
                { fechaIngreso: 'desc' },
                { rbd: 'asc' }
            ]
        })

        return { registros }
    } catch (error) {
        console.error("Error fetching Informe Carga Raciones:", error)
        return { error: 'Ocurrió un error al cargar el informe.' }
    }
}
