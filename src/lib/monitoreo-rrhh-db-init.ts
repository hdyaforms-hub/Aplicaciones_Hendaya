import { rawPrisma } from '@/lib/prisma'

let initialized = false

/**
 * Inicializador idempotente y auto-recuperable (self-healing)
 * para la configuración del módulo de Monitoreo de Recursos Humanos.
 * Preserva intactos todos los datos existentes en producción.
 */
export async function ensureMonitoreoRRHHTables() {
    if (initialized) return
    try {
        // 1. Tabla de configuración de roles asignados a monitoreo RRHH
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "monitoreo_rrhh_configuracion" (
                "id" TEXT PRIMARY KEY,
                "rolesAsignados" TEXT NOT NULL DEFAULT '[]',
                "actualizadoPor" TEXT,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        // Inyectar fila 'global' por defecto si no existe
        await rawPrisma.$executeRawUnsafe(`
            INSERT INTO "monitoreo_rrhh_configuracion" ("id", "rolesAsignados", "actualizadoPor", "updatedAt")
            VALUES ('global', '[]', 'sistema', CURRENT_TIMESTAMP)
            ON CONFLICT ("id") DO NOTHING;
        `)

        initialized = true
    } catch (error) {
        console.error('Error al inicializar tablas de monitoreo RRHH (self-healing):', error)
    }
}
