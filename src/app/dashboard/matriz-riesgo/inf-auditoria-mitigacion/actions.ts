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

export async function getFiltrosIniciales() {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_inf_auditoria_mitigacion')) {
        return { error: 'No tienes permisos para esta acción.' }
    }

    try {
        const licitacionesDb = await prisma.licitacion.findMany({
            orderBy: { licId: 'asc' }
        })

        const plantillasDb = await prisma.matrizT_Cabecera.findMany({
            where: { estado: true },
            orderBy: { titulo: 'asc' }
        })

        return { success: true, licitaciones: licitacionesDb, plantillas: plantillasDb }
    } catch (e) {
        console.error(e)
        return { error: 'Error al cargar filtros.' }
    }
}

export async function getFechasLevantamiento(licId: number, plantillaId: string, rbd: number) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_inf_auditoria_mitigacion')) {
        return { error: 'No tienes permisos para esta acción.' }
    }

    try {
        const fechas = await prisma.matrizT_RespuestasCabecera.findMany({
            where: {
                licId,
                cabeceraId: plantillaId,
                rbd
            },
            select: {
                id: true,
                fechaIngreso: true
            },
            orderBy: { fechaIngreso: 'desc' }
        })

        return { success: true, fechas }
    } catch (e) {
        console.error(e)
        return { error: 'Error al cargar fechas.' }
    }
}

export async function getReporteData(respuestaCabeceraId: string) {
    const session = await getSession()
    if (!session?.user?.role?.permissions.includes('view_inf_auditoria_mitigacion')) {
        return { error: 'No tienes permisos para esta acción.' }
    }

    try {
        // Obtener la cabecera de la respuesta
        const respuestaCabecera = await prisma.matrizT_RespuestasCabecera.findUnique({
            where: { id: respuestaCabeceraId },
            include: {
                detalles: true,
                cabecera: {
                    include: {
                        detalles: true
                    }
                }
            }
        })

        if (!respuestaCabecera) return { error: 'No se encontró la evaluación seleccionada.' }

        // Obtener información del colegio
        const colegio = await prisma.colegios.findFirst({
            where: { colRBD: respuestaCabecera.rbd }
        })

        // Obtener mitigaciones asociadas a esta plantilla y preguntas
        const mitigaciones = await prisma.matrizMitigacion.findMany({
            where: {
                matrizId: respuestaCabecera.cabeceraId
            }
        })

        return {
            success: true,
            respuestaCabecera,
            colegio,
            mitigaciones
        }
    } catch (e) {
        console.error(e)
        return { error: 'Error al generar datos del reporte.' }
    }
}
