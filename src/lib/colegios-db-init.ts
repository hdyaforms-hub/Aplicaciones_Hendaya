import { rawPrisma } from '@/lib/prisma'

let initialized = false

/**
 * Auto-recuperación y verificación de la columna 'activo' en la tabla 'Colegios'.
 * Cumple con la regla de resguardo absoluto de datos en producción e idempotencia.
 */
export async function ensureColegiosActivoColumn() {
    if (initialized) return
    try {
        await rawPrisma.$executeRawUnsafe(`
            ALTER TABLE "Colegios" 
            ADD COLUMN IF NOT EXISTS "activo" BOOLEAN DEFAULT true;
            UPDATE "Colegios" SET "activo" = true WHERE "activo" IS NULL;
        `)
        initialized = true
    } catch (e) {
        console.error("Error asegurando columna activo en Colegios:", e)
    }
}

