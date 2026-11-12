import { rawPrisma } from '@/lib/prisma'

let isInitialized = false

/**
 * Inicializador idempotente y auto-recuperable de las tablas del módulo MULTAS:
 * - Multas_Privilegio_EE
 * - Multas_IT_Elementos_Esenciales_Cab
 * - Multas_IT_Elementos_Esenciales_Det
 *
 * Garantiza resguardo absoluto en producción sin migraciones destructivas.
 */
export async function ensureMultasEETables(): Promise<void> {
    if (isInitialized) return

    try {
        // 1. Tabla de Privilegios de borrado para Carga de Elementos Esenciales
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Multas_Privilegio_EE" (
                "id" TEXT PRIMARY KEY,
                "userId" TEXT NOT NULL,
                "puedeEliminarIndividual" BOOLEAN NOT NULL DEFAULT false,
                "puedeEliminarMasivo" BOOLEAN NOT NULL DEFAULT false,
                "otorgadoPor" TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE UNIQUE INDEX IF NOT EXISTS "Multas_Privilegio_EE_userId_key"
            ON "Multas_Privilegio_EE" ("userId");
        `)

        // 2. Tabla Cabecera de Instrucción de Trabajo Elementos Esenciales
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Multas_IT_Elementos_Esenciales_Cab" (
                "id" TEXT PRIMARY KEY,
                "licId" INTEGER NOT NULL,
                "licitacionCodigoPdf" TEXT,
                "licitacionHomologada" TEXT,
                "codigoDocumento" TEXT DEFAULT 'IT - ELEMENTOS ESENCIALES PAE',
                "tituloDocumento" TEXT DEFAULT 'INSTRUCCIÓN DE TRABAJO SUPERVISIÓN ELEMENTOS ESENCIALES',
                "numeroRevision" TEXT DEFAULT '03',
                "fechaRevision" TEXT DEFAULT '10-02-2026',
                "totalPaginas" INTEGER DEFAULT 37,
                "objetivo" TEXT,
                "alcance" TEXT,
                "plazoNotificacionHoras" INTEGER DEFAULT 24,
                "plazoCorreccionDias" INTEGER DEFAULT 5,
                "aspectosModalidadesJson" TEXT,
                "causasImputabilidadJson" TEXT,
                "anexoPesajeJson" TEXT,
                "anexoFrutasVerdurasJson" TEXT,
                "nombreArchivo" TEXT,
                "archivoBase64" TEXT,
                "cargadoPor" TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE UNIQUE INDEX IF NOT EXISTS "Multas_IT_Elementos_Esenciales_Cab_licId_key"
            ON "Multas_IT_Elementos_Esenciales_Cab" ("licId");
        `)

        // 3. Tabla Detalle de Aspectos a Controlar (4 columnas + Letra clave)
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Multas_IT_Elementos_Esenciales_Det" (
                "id" TEXT PRIMARY KEY,
                "cabId" TEXT NOT NULL,
                "orden" INTEGER NOT NULL DEFAULT 1,
                "letra" VARCHAR(5) NOT NULL,
                "aspecto" TEXT NOT NULL,
                "formaEvaluar" TEXT NOT NULL,
                "periodoCorreccion" VARCHAR(10) NOT NULL DEFAULT 'NO',
                "tienePeriodoCorreccion" BOOLEAN NOT NULL DEFAULT false,
                "medioVerificacion" TEXT NOT NULL,
                "consideracionesEspecificas" TEXT,
                "pautaSolucionAnexo3" TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "Multas_IT_Elementos_Esenciales_Det_cabId_idx"
            ON "Multas_IT_Elementos_Esenciales_Det" ("cabId");
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "Multas_IT_Elementos_Esenciales_Det_letra_idx"
            ON "Multas_IT_Elementos_Esenciales_Det" ("letra");
        `)

        // 4. Tabla de Restricciones Configurables por Aspecto EE
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Multas_Aspecto_EE_Restriccion" (
                "id" TEXT PRIMARY KEY,
                "licId" INTEGER NOT NULL,
                "letra" VARCHAR(5) NOT NULL,
                "tipo" VARCHAR(20) NOT NULL DEFAULT 'ANHO',
                "anho" INTEGER,
                "fechaDesde" TIMESTAMP(3),
                "fechaHasta" TIMESTAMP(3),
                "accion" VARCHAR(20) NOT NULL DEFAULT 'VALOR_CERO',
                "valorFijo" DOUBLE PRECISION DEFAULT 0,
                "descripcion" TEXT,
                "activo" BOOLEAN NOT NULL DEFAULT true,
                "creadoPor" TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "Multas_Aspecto_EE_Restriccion_licId_letra_idx"
            ON "Multas_Aspecto_EE_Restriccion" ("licId", "letra");
        `)

        // 5. Seed inicial idempotente: Aspecto M para el año 2024 -> Valor $0 (SQL Puro y Atómico)
        await rawPrisma.$executeRawUnsafe(`
            INSERT INTO "Multas_Aspecto_EE_Restriccion" (
                "id", "licId", "letra", "tipo", "anho", "accion", "valorFijo", "descripcion", "activo", "creadoPor", "createdAt", "updatedAt"
            )
            SELECT 
                gen_random_uuid()::text,
                "licId",
                'M',
                'ANHO',
                2024,
                'VALOR_CERO',
                0,
                'Restricción normativa: Documentos del año 2024 tienen valor de cálculo $0',
                true,
                'SISTEMA',
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            FROM "AspectoEE"
            WHERE UPPER("letra") = 'M'
              AND NOT EXISTS (
                  SELECT 1 FROM "Multas_Aspecto_EE_Restriccion" r 
                  WHERE r."licId" = "AspectoEE"."licId" 
                    AND UPPER(r."letra") = 'M' 
                    AND r."tipo" = 'ANHO' 
                    AND r."anho" = 2024
              );
        `)

        isInitialized = true
    } catch (error) {
        console.error('Error al inicializar tablas Multas EE:', error)
    }
}

