import { rawPrisma } from '@/lib/prisma'

let initialized = false

/**
 * Inicializador idempotente y self-healing de las tablas de configuración
 * de Monitoreo de Matrices de Riesgo y Actas de Supervisión.
 * Garantiza resguardo absoluto de datos existentes sin migraciones destructivas.
 */
export async function ensureMonitoreoTables() {
    if (initialized) return
    try {
        // 1. Tabla de configuración global de monitoreo (roles monitoreados, etc.)
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "monitoreo_configuracion" (
                "id" TEXT PRIMARY KEY,
                "rolesAsignados" TEXT NOT NULL DEFAULT '[]',
                "actualizadoPor" TEXT,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        // Inyectar registro por defecto si no existe
        await rawPrisma.$executeRawUnsafe(`
            INSERT INTO "monitoreo_configuracion" ("id", "rolesAsignados", "actualizadoPor", "updatedAt")
            VALUES ('global', '[]', 'sistema', CURRENT_TIMESTAMP)
            ON CONFLICT ("id") DO NOTHING;
        `)

        // 2. Tabla de configuración por ítem (Matriz o Acta) con su periodicidad
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "monitoreo_item_config" (
                "id" TEXT PRIMARY KEY,
                "tipo" TEXT NOT NULL,
                "plantillaId" TEXT NOT NULL,
                "nombre" TEXT NOT NULL,
                "periodicidad" TEXT NOT NULL DEFAULT '1_MES',
                "diasCiclo" INTEGER NOT NULL DEFAULT 30,
                "activo" BOOLEAN NOT NULL DEFAULT true,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "monitoreo_item_tipo_plantilla_unique" UNIQUE ("tipo", "plantillaId")
            );
        `)

        // Índices para optimizar consultas de monitoreo
        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "idx_monitoreo_item_activo" ON "monitoreo_item_config" ("activo");
        `)
        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "idx_monitoreo_item_tipo" ON "monitoreo_item_config" ("tipo");
        `)

        initialized = true
    } catch (error) {
        console.error('Error al inicializar tablas de monitoreo (self-healing):', error)
    }
}
