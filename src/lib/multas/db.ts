import { prisma, rawPrisma } from '@/lib/prisma'

/**
 * Accesor para modelos del módulo de Multas a través de la instancia
 * de Prisma con filtro de seguridad por RBD.
 */
export function getMultasDelegate(modelName: string): any {
    if ((prisma as any)?.[modelName]) {
        return (prisma as any)[modelName]
    }
    if ((rawPrisma as any)?.[modelName]) {
        return (rawPrisma as any)[modelName]
    }
    return (prisma as any)?.[modelName]
}
