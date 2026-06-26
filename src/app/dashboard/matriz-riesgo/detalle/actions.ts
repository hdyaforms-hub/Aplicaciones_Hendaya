'use server'

import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { endOfMonth } from 'date-fns'

async function getUserFilters() {
    const session = await getSession();
    console.log("[DEBUG getUserFilters] SESSION USER:", session?.user);
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

    console.log("[DEBUG getUserFilters] RETURNING:", { isAdmin, userSucursales, allowedUTs, userRbds });
    return { isAdmin, userSucursales, allowedUTs, userRbds };
}

export async function getLicitaciones() {
    try {
        const licitaciones = await prisma.licitacion.findMany({
            where: { estado: 1 },
            orderBy: { licitacionHomologada: 'asc' }
        })
        return { licitaciones }
    } catch (e) {
        console.error(e)
        return { error: 'Error al cargar licitaciones.' }
    }
}

export async function getUtsPorLicitacion(licId: number) {
    try {
        const { isAdmin, allowedUTs, userRbds } = await getUserFilters()
        const where: any = { licId: licId, estado: 1 }
        
        if (!isAdmin) {
            let combinedUTs = [...allowedUTs]
            if (userRbds.length > 0) {
                const extraCols = await prisma.colegiosMatriz.findMany({ where: { colRBD: { in: userRbds } } })
                combinedUTs = Array.from(new Set([...combinedUTs, ...extraCols.map(c => c.colut)]))
            }
            where.codUT = { in: combinedUTs }
        }

        const uts = await prisma.uT.findMany({
            where,
            orderBy: { codUT: 'asc' }
        })
        return { uts }
    } catch (e) {
        console.error(e)
        return { error: 'Error al cargar UTs.' }
    }
}

export async function searchColegios(query: string) {
    try {
        if (!query || query.length < 3) return { colegios: [] }
        const searchNum = parseInt(query)
        const isNum = !isNaN(searchNum)

        const { isAdmin, userSucursales, userRbds } = await getUserFilters()
        
        const baseOrConds = [
            isNum ? { colRBD: searchNum } : {},
            { nombreEstablecimiento: { contains: query } }
        ].filter(condition => Object.keys(condition).length > 0)

        const where: any = {
            isActive: true,
            AND: [
                { OR: baseOrConds }
            ]
        }

        if (!isAdmin) {
            const orConditions = []
            if (userSucursales.length > 0) orConditions.push({ sucursal: { in: userSucursales } })
            if (userRbds.length > 0) orConditions.push({ colRBD: { in: userRbds } })

            if (orConditions.length > 0) {
                where.AND.push({ OR: orConditions })
            } else {
                where.AND.push({ id: 'NO_DATA' })
            }
        }

        const colegios = await prisma.colegiosMatriz.findMany({
            where,
            take: 20
        })
        return { colegios }
    } catch (e) {
        console.error(e)
        return { error: 'Error al buscar colegios.' }
    }
}

export async function getRespuestasPaginadas(
    page: number = 1, 
    limit: number = 10,
    filters: { licId?: number, ut?: number, rbd?: number },
    sort: { field: string, order: 'asc' | 'desc' },
    year: number = new Date().getFullYear()
) {
    try {
        const configSemestre = await prisma.matrizConfigSemestre.findUnique({ where: { anio: year } })
        if (!configSemestre) return { error: `Debe configurar la fecha de corte para el año ${year} en Colegios Activos.` }

        const startDate = new Date(year, 2, 1);
        const endDate = endOfMonth(new Date(year + 1, 1));

        const skip = (page - 1) * limit
        const { isAdmin, allowedUTs, userRbds } = await getUserFilters()
        
        const where: any = {
            fechaIngreso: {
                gte: startDate,
                lte: endDate
            }
        }
        if (filters.licId) where.licId = filters.licId
        if (filters.ut) where.ut = filters.ut
        if (filters.rbd) where.rbd = filters.rbd

        if (!isAdmin) {
            const orConditions = []
            if (allowedUTs.length > 0) orConditions.push({ ut: { in: allowedUTs } })
            if (userRbds.length > 0) orConditions.push({ rbd: { in: userRbds } })

            if (orConditions.length > 0) {
                if (Object.keys(where).length > 0) {
                    where.AND = [ { OR: orConditions } ]
                } else {
                    where.OR = orConditions
                }
            } else {
                where.id = 'NO_DATA'
            }
        }

        let orderBy: any = {}
        if (sort.field === 'establecimiento') {
            // We can't sort directly on joined table if we do simple findMany, 
            // but we can sort by rbd for now, or just fetch and sort.
            orderBy = { rbd: sort.order }
        } else {
            orderBy = { [sort.field]: sort.order }
        }

        const [total, respuestas] = await Promise.all([
            prisma.matrizT_RespuestasCabecera.count({ where }),
            prisma.matrizT_RespuestasCabecera.findMany({
                where,
                skip,
                take: limit,
                orderBy,
                include: {
                    cabecera: { select: { titulo: true, anio: true } }
                }
            })
        ])

        // Fetch Colegios info to append names
        const rbds = respuestas.map(r => r.rbd)
        const colegios = await prisma.colegiosMatriz.findMany({
            where: { colRBD: { in: rbds } }
        })
        
        const colegioMap = new Map(colegios.map(c => [c.colRBD, c.nombreEstablecimiento]))

        const mappedRespuestas = respuestas.map(r => ({
            ...r,
            establecimiento: colegioMap.get(r.rbd) || 'Desconocido'
        }))

        // Handle client side sort for establecimiento if requested
        if (sort.field === 'establecimiento') {
            mappedRespuestas.sort((a, b) => {
                const nameA = a.establecimiento.toLowerCase()
                const nameB = b.establecimiento.toLowerCase()
                if (sort.order === 'asc') return nameA.localeCompare(nameB)
                return nameB.localeCompare(nameA)
            })
        }

        return { total, respuestas: mappedRespuestas }
    } catch (e) {
        console.error(e)
        return { error: 'Error al obtener respuestas.' }
    }
}

export async function deleteRespuesta(id: string) {
    const session = await getSession()
    if (session?.user?.role?.name !== 'Administrador' && session?.user?.role?.name !== 'admin') {
        return { error: 'Solo el administrador puede eliminar respuestas.' }
    }

    try {
        await prisma.matrizT_RespuestasCabecera.delete({
            where: { id }
        })
        revalidatePath('/dashboard/matriz-riesgo/detalle')
        return { success: true }
    } catch (e) {
        console.error(e)
        return { error: 'Error al eliminar la respuesta.' }
    }
}

export async function getAllRespuestasExport(year: number = new Date().getFullYear()) {
    try {
        const configSemestre = await prisma.matrizConfigSemestre.findUnique({ where: { anio: year } })
        if (!configSemestre) return { error: `Debe configurar la fecha de corte para el año ${year} en Colegios Activos.` }

        const startDate = new Date(year, 2, 1);
        const endDate = endOfMonth(new Date(year + 1, 1));

        const { isAdmin, allowedUTs, userRbds } = await getUserFilters()
        const where: any = {
            fechaIngreso: {
                gte: startDate,
                lte: endDate
            }
        }
        
        if (!isAdmin) {
            const orConditions = []
            if (allowedUTs.length > 0) orConditions.push({ ut: { in: allowedUTs } })
            if (userRbds.length > 0) orConditions.push({ rbd: { in: userRbds } })

            if (orConditions.length > 0) {
                where.OR = orConditions
            } else {
                where.id = 'NO_DATA'
            }
        }

        const respuestas = await prisma.matrizT_RespuestasCabecera.findMany({
            where,
            orderBy: { fechaIngreso: 'desc' },
            include: {
                cabecera: { select: { titulo: true, anio: true } }
            }
        })

        const rbds = respuestas.map(r => r.rbd)
        const colegios = await prisma.colegiosMatriz.findMany({
            where: { colRBD: { in: rbds } }
        })
        const colegioMap = new Map(colegios.map(c => [c.colRBD, c.nombreEstablecimiento]))

        return { 
            data: respuestas.map(r => ({
                ID: r.id,
                Matriz: `${r.cabecera.titulo} (${r.cabecera.anio})`,
                Licitacion: r.licId,
                UT: r.ut,
                RBD: r.rbd,
                Establecimiento: colegioMap.get(r.rbd) || 'Desconocido',
                Usuario: r.usuario,
                Supervisor: r.supervisorNombre + (r.supervisorNombreOriginal ? ` (Original: ${r.supervisorNombreOriginal})` : ''),
                Fecha: r.fechaIngreso.toISOString().split('T')[0]
            }))
        }
    } catch (e) {
        console.error(e)
        return { error: 'Error al exportar datos.' }
    }
}

export async function getRespuestaCompleta(id: string) {
    try {
        const respuesta = await prisma.matrizT_RespuestasCabecera.findUnique({
            where: { id },
            include: {
                cabecera: {
                    include: {
                        detalles: {
                            orderBy: { orden: 'asc' }
                        }
                    }
                },
                detalles: true
            }
        })
        if (!respuesta) return { error: 'Respuesta no encontrada.' }

        const colegio = await prisma.colegiosMatriz.findUnique({
            where: { colRBD: respuesta.rbd }
        })

        return { respuesta, colegioNombre: colegio?.nombreEstablecimiento || 'Desconocido' }
    } catch (e) {
        console.error(e)
        return { error: 'Error al obtener respuesta.' }
    }
}

export async function updateRespuesta(respuestaCabeceraId: string, respuestas: any[]) {
    const session = await getSession()
    if (session?.user?.role?.name !== 'Administrador' && session?.user?.role?.name !== 'admin') {
        return { error: 'Solo el administrador puede modificar respuestas.' }
    }

    try {
        for (const ans of respuestas) {
            const existing = await prisma.matrizT_RespuestasDetalle.findFirst({
                where: { respuestaCabeceraId, preguntaId: ans.preguntaId }
            })
            if (existing) {
                await prisma.matrizT_RespuestasDetalle.update({
                    where: { id: existing.id },
                    data: {
                        valor: ans.valor || null,
                        adjuntoUrl: ans.adjuntoUrl || null
                    }
                })
            } else {
                await prisma.matrizT_RespuestasDetalle.create({
                    data: {
                        respuestaCabeceraId,
                        preguntaId: ans.preguntaId,
                        valor: ans.valor || null,
                        adjuntoUrl: ans.adjuntoUrl || null
                    }
                })
            }
        }
        revalidatePath(`/dashboard/matriz-riesgo/detalle/${respuestaCabeceraId}`)
        return { success: true }
    } catch (e) {
        console.error(e)
        return { error: 'Error al actualizar respuestas.' }
    }
}
