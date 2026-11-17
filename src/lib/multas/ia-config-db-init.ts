import { rawPrisma } from '@/lib/prisma'

let isInitialized = false

/**
 * Inicializador idempotente y auto-recuperable de las tablas de Inteligencia Artificial (C10):
 * - Multas_Config_IA
 * - Multas_Log_Consumo_IA
 */
export async function ensureIaConfigTables(): Promise<void> {
    if (isInitialized) return

    try {
        // 1. Configuración de IA
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Multas_Config_IA" (
                "id" TEXT PRIMARY KEY,
                "proveedor" VARCHAR(50) NOT NULL DEFAULT 'GOOGLE_GEMINI',
                "apiKeyEnc" TEXT,
                "modelo" VARCHAR(100) NOT NULL DEFAULT 'gemini-1.5-flash',
                "limiteGastoMensualUsd" DOUBLE PRECISION NOT NULL DEFAULT 50.0,
                "gastoAcumuladoMesUsd" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                "temperatura" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
                "activo" BOOLEAN NOT NULL DEFAULT true,
                "actualizadoPor" VARCHAR(100) NOT NULL DEFAULT 'Sistema',
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        // 2. Registro de Logs y Consumo de IA
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Multas_Log_Consumo_IA" (
                "id" TEXT PRIMARY KEY,
                "folio" VARCHAR(50),
                "usuario" VARCHAR(100) NOT NULL,
                "tipoOperacion" VARCHAR(60) NOT NULL,
                "modeloUsado" VARCHAR(100) NOT NULL,
                "tokensPrompt" INTEGER NOT NULL DEFAULT 0,
                "tokensRespuesta" INTEGER NOT NULL DEFAULT 0,
                "costoEstimadoUsd" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                "tiempoRespuestaMs" INTEGER NOT NULL DEFAULT 0,
                "exitoso" BOOLEAN NOT NULL DEFAULT true,
                "errorMensaje" TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "multas_log_ia_folio_idx"
            ON "Multas_Log_Consumo_IA" ("folio");
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "multas_log_ia_usuario_idx"
            ON "Multas_Log_Consumo_IA" ("usuario");
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "multas_log_ia_created_idx"
            ON "Multas_Log_Consumo_IA" ("createdAt");
        `)

        // Registro predeterminado de configuración si la tabla está vacía
        const countConfig = await rawPrisma.$queryRawUnsafe<any[]>(`
            SELECT COUNT(*)::int as count FROM "Multas_Config_IA";
        `).catch(() => [{ count: 1 }])

        if (Number(countConfig[0]?.count || 0) === 0) {
            await rawPrisma.$executeRawUnsafe(`
                INSERT INTO "Multas_Config_IA" 
                ("id", "proveedor", "modelo", "limiteGastoMensualUsd", "gastoAcumuladoMesUsd", "temperatura", "activo", "actualizadoPor")
                VALUES 
                (
                    gen_random_uuid()::text,
                    'GOOGLE_GEMINI',
                    'gemini-1.5-flash',
                    50.0,
                    0.0,
                    0.2,
                    true,
                    'Configuración Inicial'
                );
            `)
        }

        isInitialized = true
    } catch (error) {
        console.error('Error al inicializar tablas de Inteligencia Artificial:', error)
    }
}
