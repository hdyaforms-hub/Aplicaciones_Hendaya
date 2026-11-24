import { rawPrisma } from '@/lib/prisma'

let initialized = false

/**
 * Auto-recuperación y migración idempotente de columnas para Bloqueo y/o Retirada de Productos.
 * Protege datos existentes en producción sin requerir migraciones destructivas.
 */
export async function ensureRetornoProductosTables() {
    if (initialized) return
    try {
        // Nuevas columnas en RetornoProductosAlerta
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "RetornoProductosAlerta" ADD COLUMN IF NOT EXISTS "tipoBloqueo" TEXT DEFAULT 'Preventivo';`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "RetornoProductosAlerta" ADD COLUMN IF NOT EXISTS "alcance" TEXT DEFAULT 'A Hendaya';`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "RetornoProductosAlerta" ADD COLUMN IF NOT EXISTS "nombreProducto" TEXT;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "RetornoProductosAlerta" ADD COLUMN IF NOT EXISTS "marcaProducto" TEXT;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "RetornoProductosAlerta" ADD COLUMN IF NOT EXISTS "fechaElaboracion" TEXT;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "RetornoProductosAlerta" ADD COLUMN IF NOT EXISTS "fechaVencimiento" TEXT;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "RetornoProductosAlerta" ADD COLUMN IF NOT EXISTS "lote" TEXT;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "RetornoProductosAlerta" ADD COLUMN IF NOT EXISTS "historialEstado" TEXT;`)

        // Nuevas columnas en RetornoProductosMovimiento
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "RetornoProductosMovimiento" ADD COLUMN IF NOT EXISTS "numeroDocumento" TEXT;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "RetornoProductosMovimiento" ADD COLUMN IF NOT EXISTS "codigoProducto" TEXT;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "RetornoProductosMovimiento" ADD COLUMN IF NOT EXISTS "cantidadRecepcionada" DOUBLE PRECISION DEFAULT 0;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "RetornoProductosMovimiento" ADD COLUMN IF NOT EXISTS "loteInterno" TEXT;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "RetornoProductosMovimiento" ADD COLUMN IF NOT EXISTS "stockBodega" DOUBLE PRECISION DEFAULT 0;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "RetornoProductosMovimiento" ADD COLUMN IF NOT EXISTS "ubicacion" TEXT;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "RetornoProductosMovimiento" ADD COLUMN IF NOT EXISTS "cantidadDespachada" DOUBLE PRECISION DEFAULT 0;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "RetornoProductosMovimiento" ADD COLUMN IF NOT EXISTS "cantidadMermada" DOUBLE PRECISION DEFAULT 0;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "RetornoProductosMovimiento" ADD COLUMN IF NOT EXISTS "tipoDestino" TEXT DEFAULT 'BODEGA';`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "RetornoProductosMovimiento" ADD COLUMN IF NOT EXISTS "rbd" INTEGER;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "RetornoProductosMovimiento" ADD COLUMN IF NOT EXISTS "establecimiento" TEXT;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "RetornoProductosMovimiento" ADD COLUMN IF NOT EXISTS "cantidadRbd" DOUBLE PRECISION DEFAULT 0;`)

        initialized = true
    } catch (error) {
        console.error('Error inicializando columnas de Bloqueo y Retirada de Productos:', error)
    }
}
