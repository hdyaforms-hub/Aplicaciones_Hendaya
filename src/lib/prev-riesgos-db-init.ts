import { rawPrisma } from '@/lib/prisma'

let initialized = false

/**
 * Inicializador idempotente y auto-recuperable (self-healing)
 * para la configuración del módulo de Prevención de Riesgos en Mantenedor.
 * Preserva intactos todos los datos existentes en producción.
 */
export async function ensurePrevRiesgosConfigTables() {
    if (initialized) return
    try {
        // 1. Tabla de configuración de roles a visualizar en Prevención de Riesgos
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "prev_riesgos_configuracion" (
                "id" TEXT PRIMARY KEY,
                "rolesVisualizar" TEXT NOT NULL DEFAULT '[]',
                "actualizadoPor" TEXT,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        // 2. Registro 'global' inicial si no existe
        await rawPrisma.$executeRawUnsafe(`
            INSERT INTO "prev_riesgos_configuracion" ("id", "rolesVisualizar", "actualizadoPor", "updatedAt")
            VALUES ('global', '[]', 'sistema', CURRENT_TIMESTAMP)
            ON CONFLICT ("id") DO NOTHING;
        `)

        initialized = true
    } catch (error) {
        console.error('Error al inicializar tablas de configuración de Prev. de Riesgos (self-healing):', error)
    }
}

