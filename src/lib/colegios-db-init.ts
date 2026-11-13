import { rawPrisma } from '@/lib/prisma'

let initialized = false
let initPromise: Promise<void> | null = null

/**
 * Auto-recuperación y verificación de la columna 'activo' en la tabla 'Colegios'.
 * Cumple con la regla de resguardo absoluto de datos en producción e idempotencia.
 */
export async function ensureColegiosActivoColumn(): Promise<void> {
    if (initialized) return
    if (initPromise) return initPromise

    initPromise = (async () => {
        try {
            // Cada orden debe ejecutarse de forma independiente en Prisma
            await rawPrisma.$executeRawUnsafe(`
                ALTER TABLE "Colegios" ADD COLUMN IF NOT EXISTS "activo" BOOLEAN DEFAULT true;
            `)
            await rawPrisma.$executeRawUnsafe(`
                UPDATE "Colegios" SET "activo" = true WHERE "activo" IS NULL;
            `)
            initialized = true
        } catch (e) {
            console.error("Error asegurando columna activo en Colegios:", e)
        } finally {
            initPromise = null
        }
    })()

    return initPromise
}
