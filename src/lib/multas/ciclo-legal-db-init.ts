import { rawPrisma } from '@/lib/prisma'

let isInitialized = false

/**
 * Inicializador idempotente y auto-recuperable de las tablas del Ciclo Legal y Expediente (C7):
 * - Multas_Descargo_Formal
 * - Multas_Descargo_Folio
 * - Multas_Resuelve
 * - Multas_Recurso_Admin
 * - Multas_Proceso_Judicial
 *
 * Cumple con el resguardo de datos en producción y no requiere migraciones destructivas.
 */
export async function ensureCicloLegalTables(): Promise<void> {
    if (isInitialized) return

    try {
        // 1. Descargos Formales
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Multas_Descargo_Formal" (
                "id" TEXT PRIMARY KEY,
                "notificacionId" TEXT NOT NULL,
                "codigoIngreso" VARCHAR(100) NOT NULL,
                "fechaIngreso" TIMESTAMP(3) NOT NULL,
                "fechaPlazoRespuesta" TIMESTAMP(3),
                "diasPlazoLegal" INTEGER NOT NULL DEFAULT 30,
                "estado" VARCHAR(30) NOT NULL DEFAULT 'PRESENTADO',
                "montoImpugnadoUtm" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                "montoImpugnadoPesos" DOUBLE PRECISION,
                "resumenArgumentos" TEXT,
                "documentoUrl" TEXT,
                "documentoNombre" VARCHAR(255),
                "abogadoResponsable" VARCHAR(150),
                "creadoPor" VARCHAR(100) NOT NULL,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "fk_descargo_formal_notif" FOREIGN KEY ("notificacionId") 
                    REFERENCES "Multas_Notificacion_REX"("id") ON DELETE CASCADE ON UPDATE CASCADE
            );
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE UNIQUE INDEX IF NOT EXISTS "multas_descargo_formal_notif_cod_unique"
            ON "Multas_Descargo_Formal" ("notificacionId", "codigoIngreso");
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "multas_descargo_formal_notif_idx"
            ON "Multas_Descargo_Formal" ("notificacionId");
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "multas_descargo_formal_estado_idx"
            ON "Multas_Descargo_Formal" ("estado");
        `)

        // 2. Folios Impugnados en el Descargo
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Multas_Descargo_Folio" (
                "id" TEXT PRIMARY KEY,
                "descargoId" TEXT NOT NULL,
                "notificacionItemId" TEXT,
                "folio" VARCHAR(50) NOT NULL,
                "rbd" INTEGER,
                "aspecto" VARCHAR(10) NOT NULL,
                "montoNotificadoUtm" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                "montoImpugnadoUtm" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                "montoRebajadoUtm" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                "estado" VARCHAR(30) NOT NULL DEFAULT 'IMPUGNADO',
                "argumentoPrincipal" TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "fk_descargo_folio_descargo" FOREIGN KEY ("descargoId") 
                    REFERENCES "Multas_Descargo_Formal"("id") ON DELETE CASCADE ON UPDATE CASCADE
            );
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "multas_descargo_folio_descargo_idx"
            ON "Multas_Descargo_Folio" ("descargoId");
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "multas_descargo_folio_folio_idx"
            ON "Multas_Descargo_Folio" ("folio");
        `)

        // 3. Resuelve (Resolución de Término JUNAEB)
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Multas_Resuelve" (
                "id" TEXT PRIMARY KEY,
                "descargoId" TEXT NOT NULL,
                "numeroResolucion" VARCHAR(100) NOT NULL,
                "fechaResolucion" TIMESTAMP(3) NOT NULL,
                "fechaNotificacion" TIMESTAMP(3),
                "dictamen" VARCHAR(30) NOT NULL,
                "montoRatificadoUtm" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                "montoRebajadoUtm" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                "porcentajeRebaja" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                "fundamentoResuelve" TEXT,
                "documentoUrl" TEXT,
                "documentoNombre" VARCHAR(255),
                "registradoPor" VARCHAR(100) NOT NULL,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "fk_resuelve_descargo" FOREIGN KEY ("descargoId") 
                    REFERENCES "Multas_Descargo_Formal"("id") ON DELETE CASCADE ON UPDATE CASCADE
            );
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "multas_resuelve_descargo_idx"
            ON "Multas_Resuelve" ("descargoId");
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "multas_resuelve_numero_idx"
            ON "Multas_Resuelve" ("numeroResolucion");
        `)

        // 4. Recursos Administrativos (Reposición / Jerárquico)
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Multas_Recurso_Admin" (
                "id" TEXT PRIMARY KEY,
                "descargoId" TEXT NOT NULL,
                "tipoRecurso" VARCHAR(30) NOT NULL,
                "codigoPresentacion" VARCHAR(100) NOT NULL,
                "fechaPresentacion" TIMESTAMP(3) NOT NULL,
                "autoridadDestino" VARCHAR(150),
                "estado" VARCHAR(30) NOT NULL DEFAULT 'INGRESADO',
                "resolucionRespuesta" VARCHAR(100),
                "montoRebajaExtraUtm" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                "fundamentosRecurso" TEXT,
                "documentoUrl" TEXT,
                "documentoNombre" VARCHAR(255),
                "abogado" VARCHAR(150),
                "registradoPor" VARCHAR(100) NOT NULL,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "fk_recurso_admin_descargo" FOREIGN KEY ("descargoId") 
                    REFERENCES "Multas_Descargo_Formal"("id") ON DELETE CASCADE ON UPDATE CASCADE
            );
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "multas_recurso_admin_descargo_idx"
            ON "Multas_Recurso_Admin" ("descargoId");
        `)

        // 5. Proceso Judicial
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Multas_Proceso_Judicial" (
                "id" TEXT PRIMARY KEY,
                "descargoId" TEXT NOT NULL,
                "tribunal" VARCHAR(150) NOT NULL,
                "rolCausa" VARCHAR(50) NOT NULL,
                "caratulado" VARCHAR(200),
                "fechaIngreso" TIMESTAMP(3) NOT NULL,
                "cuantiaDemandaPesos" DOUBLE PRECISION,
                "estadoProcesal" VARCHAR(50) NOT NULL DEFAULT 'DEMANDA',
                "resultadoSentencia" VARCHAR(50),
                "abogadoExterno" VARCHAR(150),
                "notas" TEXT,
                "documentoUrl" TEXT,
                "documentoNombre" VARCHAR(255),
                "registradoPor" VARCHAR(100) NOT NULL,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "fk_proceso_judicial_descargo" FOREIGN KEY ("descargoId") 
                    REFERENCES "Multas_Descargo_Formal"("id") ON DELETE CASCADE ON UPDATE CASCADE
            );
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "multas_proceso_judicial_descargo_idx"
            ON "Multas_Proceso_Judicial" ("descargoId");
        `)

        isInitialized = true
    } catch (error) {
        console.error('Error al inicializar tablas de Ciclo Legal y Expediente (C7):', error)
    }
}
