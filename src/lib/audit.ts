import { rawPrisma } from '@/lib/prisma'

export type AuditLogInput = {
    username: string
    userId?: string | null
    action: string
    modulo: string
    detalle: string
    ip?: string | null
}

export type AuditFilterParams = {
    dateFrom?: string
    dateTo?: string
    username?: string
    modulo?: string
    search?: string
    page?: number
    limit?: number
}

/**
 * Registra una acción en la tabla de auditoría.
 */
export async function logAuditAction(input: AuditLogInput) {
    try {
        if (!input.username) return null
        
        return await rawPrisma.auditLog.create({
            data: {
                username: input.username,
                userId: input.userId || null,
                action: input.action,
                modulo: input.modulo,
                detalle: input.detalle,
                ip: input.ip || null,
            }
        })
    } catch (error) {
        console.error('Error registrando auditoría:', error)
        return null
    }
}

/**
 * Obtiene la lista de usuarios únicos que tienen registros de auditoría o existen en la BD.
 */
export async function getAuditUsers() {
    try {
        const users = await rawPrisma.user.findMany({
            select: {
                username: true,
                name: true,
            },
            orderBy: { username: 'asc' }
        })

        return users.map(u => ({
            username: u.username,
            name: u.name ? `${u.name} (${u.username})` : u.username
        }))
    } catch (error) {
        console.error('Error al obtener usuarios para filtro de auditoría:', error)
        return []
    }
}

/**
 * Consulta registros de auditoría aplicando filtros de fecha, usuario, módulo y término de búsqueda.
 */
export async function getAuditLogs(params: AuditFilterParams) {
    try {
        const page = params.page || 1
        const limit = params.limit || 50
        const skip = (page - 1) * limit

        const where: any = {}

        // Filtro por fecha desde / hasta
        if (params.dateFrom || params.dateTo) {
            where.createdAt = {}
            if (params.dateFrom) {
                const startDate = new Date(params.dateFrom)
                startDate.setHours(0, 0, 0, 0)
                where.createdAt.gte = startDate
            }
            if (params.dateTo) {
                const endDate = new Date(params.dateTo)
                endDate.setHours(23, 59, 59, 999)
                where.createdAt.lte = endDate
            }
        }

        // Filtro por usuario
        if (params.username && params.username !== 'ALL') {
            where.username = params.username
        }

        // Filtro por módulo
        if (params.modulo && params.modulo !== 'ALL') {
            where.modulo = params.modulo
        }

        // Filtro por búsqueda general (detalle o acción)
        if (params.search && params.search.trim() !== '') {
            const searchTerm = params.search.trim()
            where.OR = [
                { detalle: { contains: searchTerm, mode: 'insensitive' } },
                { action: { contains: searchTerm, mode: 'insensitive' } },
                { modulo: { contains: searchTerm, mode: 'insensitive' } },
                { username: { contains: searchTerm, mode: 'insensitive' } },
            ]
        }

        const [total, logs] = await Promise.all([
            rawPrisma.auditLog.count({ where }),
            rawPrisma.auditLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            })
        ])

        return {
            logs,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        }
    } catch (error) {
        console.error('Error al obtener registros de auditoría:', error)
        return { logs: [], total: 0, page: 1, totalPages: 1 }
    }
}
