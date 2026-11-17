import { rawPrisma } from '@/lib/prisma'

let isInitialized = false

/**
 * Inicializador idempotente y auto-recuperable de las tablas de Notificaciones REX JUNAEB (C6):
 * - Multas_Notificacion_REX
 * - Multas_Notificacion_Item
 *
 * Cumple con el resguardo de datos en producción y no requiere migraciones destructivas.
 */
export async function ensureNotificacionesJunaebTables(): Promise<void> {
    if (isInitialized) return

    try {
        // 1. Cabecera de Notificaciones REX
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Multas_Notificacion_REX" (
                "id" TEXT PRIMARY KEY,
                "numeroResolucion" VARCHAR(100) NOT NULL,
                "fechaResolucion" TIMESTAMP(3),
                "periodoMes" INTEGER NOT NULL,
                "periodoAnio" INTEGER NOT NULL,
                "licitacionId" INTEGER,
                "licitacionNombre" VARCHAR(150),
                "nombreArchivo" VARCHAR(255) NOT NULL,
                "totalFilasNotif" INTEGER NOT NULL DEFAULT 0,
                "totalFoliosNotif" INTEGER NOT NULL DEFAULT 0,
                "montoTotalNotificado" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                "montoTotalCalculado" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                "montoTotalDiferencia" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                "montoTotalNotificadoPesos" DOUBLE PRECISION DEFAULT 0.0,
                "montoTotalCalculadoPesos" DOUBLE PRECISION DEFAULT 0.0,
                "montoTotalDiferenciaPesos" DOUBLE PRECISION DEFAULT 0.0,
                "estado" VARCHAR(30) NOT NULL DEFAULT 'BORRADOR',
                "cargadoPor" VARCHAR(100) NOT NULL,
                "observaciones" TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE UNIQUE INDEX IF NOT EXISTS "multas_notif_rex_numero_lic_unique"
            ON "Multas_Notificacion_REX" ("numeroResolucion", "licitacionId");
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "multas_notif_rex_periodo_idx"
            ON "Multas_Notificacion_REX" ("periodoAnio", "periodoMes");
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "multas_notif_rex_licitacion_idx"
            ON "Multas_Notificacion_REX" ("licitacionId");
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "multas_notif_rex_estado_idx"
            ON "Multas_Notificacion_REX" ("estado");
        `)

        // 2. Detalle de Items de Notificación REX
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Multas_Notificacion_Item" (
                "id" TEXT PRIMARY KEY,
                "notificacionId" TEXT NOT NULL,
                "folio" VARCHAR(50) NOT NULL,
                "rbd" INTEGER,
                "establecimiento" VARCHAR(200),
                "sucursal" VARCHAR(100),
                "fechaSupervision" TIMESTAMP(3),
                "aspecto" VARCHAR(10) NOT NULL,
                "infraccionDetalle" TEXT,
                "montoNotificado" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                "montoCalculado" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                "diferenciaMonto" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                "montoNotificadoPesos" DOUBLE PRECISION DEFAULT 0.0,
                "montoCalculadoPesos" DOUBLE PRECISION DEFAULT 0.0,
                "diferenciaPesos" DOUBLE PRECISION DEFAULT 0.0,
                "estadoConciliacion" VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
                "clasificacionError" VARCHAR(30),
                "motivoClasificacion" TEXT,
                "resolucionAnterior" VARCHAR(100),
                "clasificadoPor" VARCHAR(100),
                "clasificadoEn" TIMESTAMP(3),
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "fk_multas_notif_rex" FOREIGN KEY ("notificacionId") 
                    REFERENCES "Multas_Notificacion_REX"("id") ON DELETE CASCADE ON UPDATE CASCADE
            );
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "multas_notif_item_notif_estado_idx"
            ON "Multas_Notificacion_Item" ("notificacionId", "estadoConciliacion");
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "multas_notif_item_folio_idx"
            ON "Multas_Notificacion_Item" ("folio");
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "multas_notif_item_rbd_idx"
            ON "Multas_Notificacion_Item" ("rbd");
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "multas_notif_item_aspecto_idx"
            ON "Multas_Notificacion_Item" ("aspecto");
        `)

        // 3. Migraciones de columnas adicionales idempotentes ejecutadas UNA POR UNA después de crear ambas tablas
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Multas_Notificacion_REX" ADD COLUMN IF NOT EXISTS "montoTotalNotificadoPesos" DOUBLE PRECISION DEFAULT 0.0;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Multas_Notificacion_REX" ADD COLUMN IF NOT EXISTS "montoTotalCalculadoPesos" DOUBLE PRECISION DEFAULT 0.0;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Multas_Notificacion_REX" ADD COLUMN IF NOT EXISTS "montoTotalDiferenciaPesos" DOUBLE PRECISION DEFAULT 0.0;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Multas_Notificacion_Item" ADD COLUMN IF NOT EXISTS "montoNotificadoPesos" DOUBLE PRECISION DEFAULT 0.0;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Multas_Notificacion_Item" ADD COLUMN IF NOT EXISTS "montoCalculadoPesos" DOUBLE PRECISION DEFAULT 0.0;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Multas_Notificacion_Item" ADD COLUMN IF NOT EXISTS "diferenciaPesos" DOUBLE PRECISION DEFAULT 0.0;`)

        isInitialized = true
    } catch (error) {
        console.error('Error al inicializar tablas de Notificaciones REX JUNAEB (C6):', error)
        // No bloquear la ejecución si la tabla ya existe
    }
}
