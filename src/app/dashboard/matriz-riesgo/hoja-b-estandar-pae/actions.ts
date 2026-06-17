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

export async function searchColegiosConMatriz(query: string) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_hoja_b_estandar_pae')) {
        return { error: 'No tienes permisos para esta acción.' }
    }

    const filters = await getUserFilters();

    try {
        let whereClause: any = {}

        if (!filters.isAdmin) {
            whereClause = {
                OR: [
                    { ut: { in: filters.allowedUTs } },
                    { rbd: { in: filters.userRbds } }
                ]
            }
        }

        // Buscar colegios en la tabla ColegiosMatriz que coincidan con el query (RBD o Nombre)
        const colegios = await prisma.colegiosMatriz.findMany({
            where: {
                isActive: true,
                OR: [
                    { colRBD: isNaN(parseInt(query)) ? undefined : parseInt(query) },
                    { nombreEstablecimiento: { contains: query, mode: 'insensitive' } }
                ]
            },
            take: 20
        })

        // Filtrar colegios basándonos en si tienen alguna respuesta y si pertenecen al usuario
        const colegiosConMatriz = []
        for (const col of colegios) {
            // Verificar si hay matriz para este colegio que cumpla con los filtros de usuario
            const count = await prisma.matrizT_RespuestasCabecera.count({
                where: {
                    rbd: col.colRBD,
                    ...whereClause
                }
            })
            if (count > 0) {
                colegiosConMatriz.push(col)
            }
        }

        return { success: true, colegios: colegiosConMatriz }
    } catch (e) {
        console.error(e)
        return { error: 'Error al buscar colegios.' }
    }
}

export async function getUltimoReporteHojaB(rbd: number) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_hoja_b_estandar_pae')) {
        return { error: 'No tienes permisos para esta acción.' }
    }

    const filters = await getUserFilters()
    let whereClause: any = { rbd }

    if (!filters.isAdmin) {
        whereClause = {
            ...whereClause,
            OR: [
                { ut: { in: filters.allowedUTs } },
                { rbd: { in: filters.userRbds } }
            ]
        }
    }

    try {
        // Obtener la cabecera de la respuesta más reciente
        const respuestaCabecera = await prisma.matrizT_RespuestasCabecera.findFirst({
            where: whereClause,
            orderBy: { fechaIngreso: 'desc' },
            include: {
                detalles: true,
                cabecera: {
                    include: {
                        detalles: true
                    }
                }
            }
        })

        if (!respuestaCabecera) return { error: 'No se encontró ninguna evaluación para el RBD seleccionado.' }

        // Obtener información del colegio
        const colegio = await prisma.colegios.findFirst({
            where: { colRBD: respuestaCabecera.rbd }
        })

        return {
            success: true,
            respuestaCabecera,
            colegio
        }
    } catch (e) {
        console.error(e)
        return { error: 'Error al generar datos del reporte.' }
    }
}
