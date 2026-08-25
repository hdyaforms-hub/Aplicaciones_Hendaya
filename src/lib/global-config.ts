import { rawPrisma } from '@/lib/prisma'

export interface GlobalConfigData {
    sessionTimeoutMin: number
    updatedBy?: string | null
    updatedAt?: Date | null
}

const DEFAULT_CONFIG: GlobalConfigData = {
    sessionTimeoutMin: 30, // 30 minutos por defecto
}

/**
 * Obtiene la configuración global del sistema desde la base de datos o retorna los valores predeterminados.
 */
export async function getGlobalConfig(): Promise<GlobalConfigData> {
    try {
        const client = (rawPrisma as any).configuracionGlobal
        if (!client) {
            return DEFAULT_CONFIG
        }

        const config = await client.findUnique({
            where: { id: 'global' }
        })

        if (!config) {
            return DEFAULT_CONFIG
        }

        return {
            sessionTimeoutMin: config.sessionTimeoutMin || 30,
            updatedBy: config.updatedBy,
            updatedAt: config.updatedAt
        }
    } catch (error) {
        console.error('Error al obtener configuración global:', error)
        return DEFAULT_CONFIG
    }
}
