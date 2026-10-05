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
    roleId?: string
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
 * Obtiene la lista de roles registrados con conteo de usuarios.
 */
export async function getAuditRoles() {
    try {
        const roles = await rawPrisma.role.findMany({
            select: {
                id: true,
                name: true,
                description: true,
                _count: {
                    select: {
                        users: {
                            where: { isDeleted: false }
                        }
                    }
                }
            },
            orderBy: { name: 'asc' }
        })

        return roles
    } catch (error) {
        console.error('Error al obtener roles para filtro de auditoría:', error)
        return []
    }
}

/**
 * Obtiene la lista de usuarios activos con su rol asignado.
 */
export async function getAuditUsers() {
    try {
        const users = await rawPrisma.user.findMany({
            where: { isDeleted: false },
            select: {
                id: true,
                username: true,
                name: true,
                roleId: true,
                role: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            },
            orderBy: [
                { name: 'asc' },
                { username: 'asc' }
            ]
        })

        return users.map(u => ({
            id: u.id,
            username: u.username,
            name: u.name ? `${u.name} (${u.username})` : u.username,
            fullName: u.name || u.username,
            roleId: u.roleId,
            roleName: u.role?.name || 'Sin Rol'
        }))
    } catch (error) {
        console.error('Error al obtener usuarios para filtro de auditoría:', error)
        return []
    }
}

/**
 * Consulta registros de auditoría aplicando filtros de fecha, rol, usuario, módulo y término de búsqueda.
 */
export async function getAuditLogs(params: AuditFilterParams) {
    try {
        const page = params.page || 1
        const limit = params.limit || 50
        const skip = (page - 1) * limit

        const andConditions: any[] = []

        // Filtro por fecha desde / hasta
        if (params.dateFrom || params.dateTo) {
            const dateCond: any = {}
            if (params.dateFrom) {
                const startDate = new Date(params.dateFrom)
                startDate.setHours(0, 0, 0, 0)
                dateCond.gte = startDate
            }
            if (params.dateTo) {
                const endDate = new Date(params.dateTo)
                endDate.setHours(23, 59, 59, 999)
                dateCond.lte = endDate
            }
            andConditions.push({ createdAt: dateCond })
        }

        // Filtro por Rol y/o Usuario
        if (params.roleId && params.roleId !== 'ALL') {
            const usersInRole = await rawPrisma.user.findMany({
                where: { roleId: params.roleId, isDeleted: false },
                select: { id: true, username: true }
            })
            const usernames = usersInRole.map(u => u.username).filter(Boolean)
            const userIds = usersInRole.map(u => u.id).filter(Boolean)

            if (usernames.length === 0 && userIds.length === 0) {
                // Ningún usuario con este rol -> no retornar logs
                andConditions.push({ id: '__NON_EXISTING__' })
            } else {
                if (params.username && params.username !== 'ALL') {
                    if (usernames.includes(params.username)) {
                        andConditions.push({ username: params.username })
                    } else {
                        andConditions.push({ id: '__NON_EXISTING__' })
                    }
                } else {
                    andConditions.push({
                        OR: [
                            { username: { in: usernames } },
                            { userId: { in: userIds } }
                        ]
                    })
                }
            }
        } else if (params.username && params.username !== 'ALL') {
            andConditions.push({ username: params.username })
        }

        // Filtro por módulo
        if (params.modulo && params.modulo !== 'ALL') {
            andConditions.push({ modulo: params.modulo })
        }

        // Filtro por búsqueda general (detalle, acción, módulo o usuario)
        if (params.search && params.search.trim() !== '') {
            const searchTerm = params.search.trim()
            andConditions.push({
                OR: [
                    { detalle: { contains: searchTerm, mode: 'insensitive' } },
                    { action: { contains: searchTerm, mode: 'insensitive' } },
                    { modulo: { contains: searchTerm, mode: 'insensitive' } },
                    { username: { contains: searchTerm, mode: 'insensitive' } },
                ]
            })
        }

        const where: any = andConditions.length > 0 ? { AND: andConditions } : {}

        const [total, logs] = await Promise.all([
            rawPrisma.auditLog.count({ where }),
            rawPrisma.auditLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            })
        ])

        // Enriquecer logs con nombre completo y rol de cada usuario
        const uniqueUsernames = Array.from(new Set(logs.map(l => l.username).filter(Boolean)))
        const uniqueUserIds = Array.from(new Set(logs.map(l => l.userId).filter(Boolean))) as string[]

        const matchedUsers = await rawPrisma.user.findMany({
            where: {
                OR: [
                    { username: { in: uniqueUsernames } },
                    { id: { in: uniqueUserIds } }
                ]
            },
            select: {
                id: true,
                username: true,
                name: true,
                role: {
                    select: {
                        name: true
                    }
                }
            }
        })

        const userMetaByUsername = new Map<string, { roleName: string; fullName: string | null }>()
        const userMetaById = new Map<string, { roleName: string; fullName: string | null }>()

        for (const u of matchedUsers) {
            const meta = {
                roleName: u.role?.name || 'Sin Rol',
                fullName: u.name || null
            }
            if (u.username) userMetaByUsername.set(u.username, meta)
            if (u.id) userMetaById.set(u.id, meta)
        }

        const enrichedLogs = logs.map(log => {
            const meta = userMetaByUsername.get(log.username) || (log.userId ? userMetaById.get(log.userId) : null)
            return {
                ...log,
                roleName: meta?.roleName || 'N/A',
                fullName: meta?.fullName || null
            }
        })

        return {
            logs: enrichedLogs,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        }
    } catch (error) {
        console.error('Error al obtener registros de auditoría:', error)
        return { logs: [], total: 0, page: 1, totalPages: 1 }
    }
}
