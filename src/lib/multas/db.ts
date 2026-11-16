import { prisma, rawPrisma } from '@/lib/prisma'

/**
 * Accesor seguro y auto-recuperable para modelos del módulo de Multas.
 * Evita el error "Cannot read properties of undefined (reading 'upsert')"
 * que ocurre cuando el servidor de desarrollo de Next.js conserva en memoria
 * una instancia previa de PrismaClient anterior a la generación de nuevos modelos.
 */
export function getMultasDelegate(modelName: string): any {
    if ((prisma as any)?.[modelName]) {
        return (prisma as any)[modelName]
    }
    if ((rawPrisma as any)?.[modelName]) {
        return (rawPrisma as any)[modelName]
    }

    // Si aún no está disponible en la instancia en memoria (HMR dev cache),
    // instanciamos el cliente generado actualizado y refrescamos el singleton.
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { PrismaClient } = require('../../generated/client')
        const fresh = new PrismaClient()
        if (fresh && fresh[modelName]) {
            if (typeof globalThis !== 'undefined') {
                globalThis.rawPrismaGlobal = fresh
                globalThis.prismaGlobal = undefined
            }
            return fresh[modelName]
        }
    } catch (err) {
        console.error(`[Multas DB] Error al cargar delegado fresco para ${modelName}:`, err)
    }

    return (prisma as any)?.[modelName]
}
