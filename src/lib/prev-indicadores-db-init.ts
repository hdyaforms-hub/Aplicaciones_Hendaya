import { rawPrisma } from '@/lib/prisma'

let initialized = false

/**
 * Inicializador idempotente y auto-recuperable (self-healing)
 * para la persistencia del módulo de Indicadores de Prevención de Riesgos.
 * Nombre de tabla con prefijo obligatorio "Prev_".
 * Preserva intactos todos los datos existentes en producción.
 */
export async function ensurePrevIndicadoresTables() {
    if (initialized) return
    try {
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Prev_IndicadoresCargas" (
                "id" TEXT PRIMARY KEY,
                "anio" INTEGER NOT NULL,
                "mes" INTEGER NOT NULL,
                "periodo" TEXT NOT NULL,
                "fileName" TEXT NOT NULL,
                "fuente" TEXT,
                "dataJson" TEXT NOT NULL,
                "cargadoPor" TEXT NOT NULL,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        // Índices para búsquedas rápidas por año y mes
        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "idx_prev_indicadores_cargas_periodo" 
            ON "Prev_IndicadoresCargas" ("anio" DESC, "mes" DESC);
        `)

        initialized = true
    } catch (error) {
        console.error('Error al inicializar tablas de Indicadores de Prevención de Riesgos (self-healing):', error)
    }
}

