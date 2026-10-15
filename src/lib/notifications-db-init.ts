import { rawPrisma } from '@/lib/prisma'

let initialized = false

/**
 * Auto-recuperación y verificación de columnas condicionales en NotificacionPantalla y ListaCorreo.
 * Cumple con la regla de resguardo absoluto de datos en producción e idempotencia.
 */
export async function ensureNotificationConditionalColumns() {
    if (initialized) return
    try {
        await rawPrisma.$executeRawUnsafe(`
            ALTER TABLE "NotificacionPantalla" 
            ADD COLUMN IF NOT EXISTS "condicionTag" TEXT,
            ADD COLUMN IF NOT EXISTS "condicionOperador" TEXT DEFAULT 'ALWAYS',
            ADD COLUMN IF NOT EXISTS "condicionValor" TEXT;
        `)
        await rawPrisma.$executeRawUnsafe(`
            ALTER TABLE "ListaCorreo" 
            ADD COLUMN IF NOT EXISTS "porSucursal" TEXT;
        `)
        initialized = true
    } catch (e) {
        console.error("Error asegurando columnas condicionales en NotificacionPantalla / ListaCorreo:", e)
    }
}
