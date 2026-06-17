'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

async function getUserFilters() {
    const session = await getSession();
    if (!session?.user) return { isAdmin: false, userSucursales: [], allowedUTs: [], userRbds: [] };

    const isAdmin = session.user.role?.name === 'Administrador' || session.user.role?.name === 'admin';
    const userSucursales = session.user.sucursales || [];
    const userRbds = session.user.rbds || [];
    let allowedUTs: number[] = [];

    if (!isAdmin && userSucursales.length > 0) {
        const sucursalesDb = await prisma.sucursal.findMany({
            where: { nombre: { in: userSucursales } },
            include: { uts: true }
        });
        allowedUTs = sucursalesDb.flatMap(s => s.uts.map((ut: any) => ut.codUT));
    }

    return { isAdmin, userSucursales, allowedUTs, userRbds };
}

export async function getActiveMatrices() {
    try {
        const matrices = await prisma.matrizT_Cabecera.findMany({
            where: { estado: true },
            include: {
                licitacion: true
            },
            orderBy: { createdAt: 'desc' }
        })
        return { success: true, matrices }
    } catch (e) {
        console.error(e)
        return { error: 'Error al cargar matrices activas.' }
    }
}

export async function getColegioByRbd(rbd: number) {
    try {
        const { isAdmin, userSucursales, userRbds } = await getUserFilters()
        
        const where: any = { colRBD: rbd }
        if (!isAdmin) {
            const orConditions = []
            if (userSucursales.length > 0) orConditions.push({ sucursal: { in: userSucursales } })
            if (userRbds.length > 0) orConditions.push({ colRBD: { in: userRbds } })

            if (orConditions.length > 0) {
                where.OR = orConditions
            } else {
                where.id = 'NO_DATA'
            }
        }

        const colegio = await prisma.colegios.findFirst({
            where
        })
        if (!colegio) return { error: 'Colegio no encontrado para ese RBD o fuera de su jurisdicción.' }
        return { success: true, colegio }
    } catch (e) {
        console.error(e)
        return { error: 'Error al buscar el colegio.' }
    }
}
