'use server'

import { getSession } from '@/lib/session'
import { getAuditLogs, getAuditUsers, AuditFilterParams } from '@/lib/audit'
import { rawPrisma } from '@/lib/prisma'

export async function fetchAuditLogsAction(params: AuditFilterParams) {
    const session = await getSession()
    if (!session?.user) {
        throw new Error('No autorizado')
    }

    const permissions = session.user.role?.permissions || []
    const isAdmin = session.user.role?.name === 'admin' || session.user.role?.name === 'Administrador'

    if (!isAdmin && !permissions.includes('view_tablero_auditoria')) {
        throw new Error('Acceso denegado')
    }

    return await getAuditLogs(params)
}

export async function fetchAuditUsersAction() {
    const session = await getSession()
    if (!session?.user) return []
    return await getAuditUsers()
}

export async function fetchAllAuditLogsForExport(params: Omit<AuditFilterParams, 'page' | 'limit'>) {
    const session = await getSession()
    if (!session?.user) {
        throw new Error('No autorizado')
    }

    const permissions = session.user.role?.permissions || []
    const isAdmin = session.user.role?.name === 'admin' || session.user.role?.name === 'Administrador'

    if (!isAdmin && !permissions.includes('view_tablero_auditoria')) {
        throw new Error('Acceso denegado')
    }

    // Traer todos los registros que coinciden con los filtros (sin paginación) hasta un máximo prudente (ej. 10.000)
    const result = await getAuditLogs({ ...params, page: 1, limit: 10000 })
    return result.logs
}
