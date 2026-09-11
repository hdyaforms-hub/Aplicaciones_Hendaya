'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { logAuditAction } from '@/lib/audit'
import { revalidatePath } from 'next/cache'

export type GravedadType = 'LEVE' | 'MEDIO' | 'ALTO' | 'SIN_ASIGNAR'

export interface PreparacionFiltros {
    licitacion?: string
    nombrePreparacion?: string
    nombreSubServicio?: string
    gravedad?: string
    page?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
}

/**
 * Obtiene el listado de preparaciones con paginación de 10 registros,
 * filtros de licitación, autocompletado y subservicio, y ordenamiento dinámico.
 */
export async function getGravedadPreparaciones(filtros: PreparacionFiltros = {}) {
    try {
        const session = await getSession()
        const permissions = session?.user?.role?.permissions || []
        const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'

        if (!isAdmin && !permissions.includes('view_prev_gravedad_preparacion')) {
            throw new Error('No tienes permisos para ver el módulo de Gravedad en Preparación.')
        }

        const page = Math.max(1, filtros.page || 1)
        const limit = 10
        const skip = (page - 1) * limit

        const where: any = {}

        if (filtros.licitacion && filtros.licitacion.trim() !== '') {
            where.licitacion = filtros.licitacion.trim()
        }

        if (filtros.nombrePreparacion && filtros.nombrePreparacion.trim() !== '') {
            const term = filtros.nombrePreparacion.trim()
            const isNum = !isNaN(Number(term))
            if (isNum) {
                where.OR = [
                    { nombrePreparacion: { contains: term, mode: 'insensitive' } },
                    { numeroPreparacion: parseInt(term, 10) }
                ]
            } else {
                where.nombrePreparacion = { contains: term, mode: 'insensitive' }
            }
        }

        if (filtros.nombreSubServicio && filtros.nombreSubServicio.trim() !== '' && filtros.nombreSubServicio !== 'ALL') {
            where.nombreSubServicio = filtros.nombreSubServicio.trim()
        }

        if (filtros.gravedad && filtros.gravedad.trim() !== '' && filtros.gravedad !== 'ALL') {
            where.gravedad = filtros.gravedad.trim()
        }

        // Ordenamiento
        const validSortColumns = ['licitacion', 'numeroPreparacion', 'nombrePreparacion', 'nombreSubServicio', 'gravedad', 'updatedAt']
        const sortBy = validSortColumns.includes(filtros.sortBy || '') ? filtros.sortBy! : 'numeroPreparacion'
        const sortOrder = filtros.sortOrder === 'desc' ? 'desc' : 'asc'

        const orderBy: any = { [sortBy]: sortOrder }

        // Consultar datos paginados y totales en paralelo
        const [items, total, totalGlobal, asignadas, alto, medio, leve] = await Promise.all([
            rawPrisma.prevGravedadPreparacion.findMany({
                where,
                skip,
                take: limit,
                orderBy,
            }),
            rawPrisma.prevGravedadPreparacion.count({ where }),
            rawPrisma.prevGravedadPreparacion.count(),
            rawPrisma.prevGravedadPreparacion.count({ where: { gravedad: { not: 'SIN_ASIGNAR' } } }),
            rawPrisma.prevGravedadPreparacion.count({ where: { gravedad: 'ALTO' } }),
            rawPrisma.prevGravedadPreparacion.count({ where: { gravedad: 'MEDIO' } }),
            rawPrisma.prevGravedadPreparacion.count({ where: { gravedad: 'LEVE' } }),
        ])

        const sinAsignar = totalGlobal - asignadas

        return {
            success: true,
            items,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit) || 1,
            kpis: {
                totalGlobal,
                asignadas,
                sinAsignar,
                alto,
                medio,
                leve
            }
        }
    } catch (error: any) {
        console.error('Error al obtener gravedad de preparaciones:', error)
        return {
            success: false,
            error: error.message || 'Error al obtener registros.',
            items: [],
            total: 0,
            page: 1,
            limit: 10,
            totalPages: 1,
            kpis: { totalGlobal: 0, asignadas: 0, sinAsignar: 0, alto: 0, medio: 0, leve: 0 }
        }
    }
}

/**
 * Asigna o actualiza la gravedad de una preparación y registra en Auditoría.
 */
export async function actualizarGravedadPreparacion(
    id: string,
    gravedad: GravedadType,
    observaciones?: string
) {
    try {
        const session = await getSession()
        const permissions = session?.user?.role?.permissions || []
        const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'

        if (!isAdmin && !permissions.includes('manage_prev_gravedad_preparacion')) {
            return { success: false, error: 'No tienes permisos para modificar la gravedad de preparaciones.' }
        }

        const validGravedades: GravedadType[] = ['LEVE', 'MEDIO', 'ALTO', 'SIN_ASIGNAR']
        if (!validGravedades.includes(gravedad)) {
            return { success: false, error: 'Gravedad no válida.' }
        }

        const itemActual = await rawPrisma.prevGravedadPreparacion.findUnique({
            where: { id }
        })

        if (!itemActual) {
            return { success: false, error: 'Preparación no encontrada.' }
        }

        const updatedBy = session.user.name || session.user.username || 'Sistema'

        const updated = await rawPrisma.prevGravedadPreparacion.update({
            where: { id },
            data: {
                gravedad,
                observaciones: observaciones !== undefined ? observaciones : itemActual.observaciones,
                updatedBy,
            }
        })

        // Registro en Auditoría
        await logAuditAction({
            username: session.user.username,
            userId: session.user.id,
            action: 'Asignar Gravedad',
            modulo: 'Áreas -> Prev. de riesgos',
            detalle: `Asignó gravedad [${gravedad}] a la preparación #${itemActual.numeroPreparacion} "${itemActual.nombrePreparacion}" (Licitación: ${itemActual.licitacion}). Gravedad anterior: [${itemActual.gravedad}].`
        })

        revalidatePath('/dashboard/areas/prevencion-riesgos/gravedad-preparacion')

        return { success: true, item: updated }
    } catch (error: any) {
        console.error('Error al actualizar gravedad:', error)
        return { success: false, error: error.message || 'Error al actualizar registro.' }
    }
}

/**
 * Sincroniza preparaciones únicas desde el Mantenedor de Preparaciones hacia Prev_GravedadPreparacion.
 */
export async function sincronizarPreparacionesAction() {
    try {
        const session = await getSession()
        const permissions = session?.user?.role?.permissions || []
        const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'

        if (!isAdmin && !permissions.includes('manage_prev_gravedad_preparacion')) {
            return { success: false, error: 'No tienes permisos para sincronizar preparaciones.' }
        }

        const insertedCount = await rawPrisma.$executeRawUnsafe(`
            INSERT INTO "hend_app"."Prev_GravedadPreparacion" (
                "id", "licitacion", "numeroPreparacion", "nombrePreparacion", 
                "codigoSubServicio", "nombreSubServicio", "gravedad", "updatedAt", "createdAt"
            )
            SELECT 
                gen_random_uuid(), 
                p."licitacion", 
                p."numeroPreparacion", 
                p."nombrePreparacion", 
                p."codigoSubServicio", 
                p."nombreSubServicio", 
                'SIN_ASIGNAR', 
                NOW(), 
                NOW()
            FROM (
                SELECT DISTINCT ON ("licitacion", "numeroPreparacion") 
                    "licitacion", "numeroPreparacion", "nombrePreparacion", "codigoSubServicio", "nombreSubServicio"
                FROM "hend_app"."Preparaciones"
            ) p
            ON CONFLICT ("licitacion", "numeroPreparacion") DO NOTHING;
        `)

        const totalActual = await rawPrisma.prevGravedadPreparacion.count()

        // Log en auditoría
        await logAuditAction({
            username: session.user.username,
            userId: session.user.id,
            action: 'Sincronizar Preparaciones',
            modulo: 'Áreas -> Prev. de riesgos',
            detalle: `Sincronizó preparaciones desde Mantenedor de Preparaciones. Nuevos registros ingresados: ${insertedCount}. Total registros en Prevención de Riesgos: ${totalActual}.`
        })

        revalidatePath('/dashboard/areas/prevencion-riesgos/gravedad-preparacion')

        return { success: true, insertedCount, totalActual }
    } catch (error: any) {
        console.error('Error al sincronizar preparaciones:', error)
        return { success: false, error: error.message || 'Error al ejecutar sincronización.' }
    }
}

/**
 * Autocompletado inteligente: busca nombres de preparaciones sugeridos.
 */
export async function buscarSugerenciasPreparacionAction(term: string, licitacion?: string) {
    try {
        if (!term || term.trim().length < 2) return []

        const cleanTerm = term.trim()
        const where: any = {
            nombrePreparacion: { contains: cleanTerm, mode: 'insensitive' }
        }

        if (licitacion && licitacion.trim() !== '') {
            where.licitacion = licitacion.trim()
        }

        const results = await rawPrisma.prevGravedadPreparacion.findMany({
            where,
            select: { nombrePreparacion: true },
            distinct: ['nombrePreparacion'],
            take: 8,
            orderBy: { nombrePreparacion: 'asc' }
        })

        return results.map(r => r.nombrePreparacion)
    } catch (error) {
        console.error('Error al autocompletar preparaciones:', error)
        return []
    }
}

/**
 * Retorna las opciones disponibles para los filtros (Licitaciones y Subservicios).
 */
export async function getFiltrosDisponiblesAction() {
    try {
        const [licitacionesRes, subServiciosRes] = await Promise.all([
            rawPrisma.prevGravedadPreparacion.groupBy({
                by: ['licitacion'],
                orderBy: { licitacion: 'asc' }
            }),
            rawPrisma.prevGravedadPreparacion.groupBy({
                by: ['nombreSubServicio'],
                where: { nombreSubServicio: { not: null } },
                orderBy: { nombreSubServicio: 'asc' }
            })
        ])

        return {
            licitaciones: licitacionesRes.map(l => l.licitacion).filter(Boolean),
            subServicios: subServiciosRes.map(s => s.nombreSubServicio).filter(Boolean) as string[]
        }
    } catch (error) {
        console.error('Error al obtener filtros disponibles:', error)
        return { licitaciones: [], subServicios: [] }
    }
}
