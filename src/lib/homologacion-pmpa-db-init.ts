import { rawPrisma } from '@/lib/prisma'

let isInitialized = false

/**
 * Inicializador idempotente y auto-recuperable de la tabla PMPA_Homologacion_Programas.
 * Garantiza resguardo absoluto en producción sin migraciones destructivas.
 */
export async function ensureHomologacionPmpaTable(): Promise<void> {
    if (isInitialized) return

    try {
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "PMPA_Homologacion_Programas" (
                "id" TEXT PRIMARY KEY,
                "programaPmpa" TEXT NOT NULL,
                "servicioPmpa" TEXT NOT NULL DEFAULT '',
                "codigoHomologado" TEXT NOT NULL DEFAULT '',
                "descripcion" TEXT,
                "actualizadoPor" TEXT,
                "actualizadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE UNIQUE INDEX IF NOT EXISTS "idx_pmpa_homologacion_prog_serv"
            ON "PMPA_Homologacion_Programas" ("programaPmpa", "servicioPmpa");
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "idx_pmpa_homologacion_cod_homologado"
            ON "PMPA_Homologacion_Programas" ("codigoHomologado");
        `)

        isInitialized = true
    } catch (error) {
        console.error('Error al inicializar tabla PMPA_Homologacion_Programas:', error)
    }
}

