import { rawPrisma } from '@/lib/prisma'

let initialized = false

/**
 * Mecanismo de auto-recuperación y creación idempotente de tablas para Cambio de RBD (Personal).
 * Cumple con la regla de resguardo de datos en producción y creación física sin migraciones destructivas.
 */
export async function ensurePersonalCambioRbdTables() {
    if (initialized) return
    try {
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Pers_Cambio_Rbd" (
                id TEXT PRIMARY KEY,
                "colaboradorId" TEXT,
                "rutEnc" TEXT NOT NULL,
                "rutHash" TEXT NOT NULL,
                "nombreEnc" TEXT NOT NULL,
                "rbdOrigen" INTEGER NOT NULL,
                "establecimientoOrigen" TEXT,
                "sucursalOrigen" TEXT,
                supervisor TEXT,
                "rbdDestino" INTEGER NOT NULL,
                "establecimientoDestino" TEXT NOT NULL,
                "sucursalDestino" TEXT,
                "tipoCambio" TEXT NOT NULL,
                "fechaDesde" TEXT NOT NULL,
                "fechaHasta" TEXT,
                observacion TEXT,
                estado TEXT NOT NULL DEFAULT 'REGISTRADO',
                "creadoPor" TEXT NOT NULL,
                "creadoPorId" TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_cambio_rbd_origen_idx" ON "Pers_Cambio_Rbd"("rbdOrigen");`)
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_cambio_rbd_destino_idx" ON "Pers_Cambio_Rbd"("rbdDestino");`)
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_cambio_rbd_ruthash_idx" ON "Pers_Cambio_Rbd"("rutHash");`)

        initialized = true
    } catch (error) {
        console.error('Error inicializando tabla Pers_Cambio_Rbd:', error)
    }
}
