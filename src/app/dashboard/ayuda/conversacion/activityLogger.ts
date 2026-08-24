import { rawPrisma } from '@/lib/prisma'

export interface LogActivityParams {
    projectId: string
    type: 'CHAT' | 'TASK' | 'GANTT' | 'DECISION' | 'WHITEBOARD' | 'NOTE'
    title: string
    description?: string | null
    metadata?: Record<string, any> | null
    username: string
    userFullName?: string | null
}

/**
 * Registra un evento de actividad en el timeline del proyecto de forma asíncrona
 */
export async function logProjectActivity(params: LogActivityParams) {
    if (!params.projectId) return null

    try {
        const metaStr = params.metadata ? JSON.stringify(params.metadata) : null
        const activity = await (rawPrisma as any).collabProjectActivityLog.create({
            data: {
                projectId: params.projectId,
                type: params.type,
                title: params.title,
                description: params.description || null,
                metadata: metaStr,
                username: params.username,
                userFullName: params.userFullName || params.username
            }
        })
        return activity
    } catch (e) {
        console.error('Error al registrar actividad de proyecto:', e)
        return null
    }
}
