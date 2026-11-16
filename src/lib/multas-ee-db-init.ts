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

        // 5. Tabla de Parámetros Globales por Licitación (Hub C1)
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Multas_Parametros_Licitacion" (
                "id" TEXT PRIMARY KEY,
                "licId" INTEGER NOT NULL,
                "modulosActivosJson" TEXT,
                "ratioManipuladorasH" INTEGER NOT NULL DEFAULT 70,
                "tempRefriMin" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                "tempRefriMax" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
                "tempCongelacionMax" DOUBLE PRECISION NOT NULL DEFAULT -18.0,
                "toleranciaFLeve" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
                "toleranciaFModerado" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
                "toleranciaFGrave" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                "plazoCorreccionDias" INTEGER NOT NULL DEFAULT 5,
                "tablaAqlJson" TEXT,
                "causasNoImputablesJson" TEXT,
                "activo" BOOLEAN NOT NULL DEFAULT true,
                "usuarioModif" TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE UNIQUE INDEX IF NOT EXISTS "Multas_Parametros_Licitacion_licId_key"
            ON "Multas_Parametros_Licitacion" ("licId");
        `)

        // 6. Claves Foráneas con ON DELETE CASCADE (Idempotentes)
        await rawPrisma.$executeRawUnsafe(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints 
                    WHERE constraint_name = 'fk_multas_privilegio_user' 
                      AND table_name = 'Multas_Privilegio_EE'
                ) THEN
                    ALTER TABLE "Multas_Privilegio_EE" 
                    ADD CONSTRAINT fk_multas_privilegio_user 
                    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
                END IF;
            END $$;
        `)

        await rawPrisma.$executeRawUnsafe(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints 
                    WHERE constraint_name = 'fk_multas_it_cab_lic' 
                      AND table_name = 'Multas_IT_Elementos_Esenciales_Cab'
                ) THEN
                    ALTER TABLE "Multas_IT_Elementos_Esenciales_Cab" 
                    ADD CONSTRAINT fk_multas_it_cab_lic 
                    FOREIGN KEY ("licId") REFERENCES "Licitacion"("licId") ON DELETE CASCADE;
                END IF;
            END $$;
        `)

        await rawPrisma.$executeRawUnsafe(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints 
                    WHERE constraint_name = 'fk_multas_it_det_cab' 
                      AND table_name = 'Multas_IT_Elementos_Esenciales_Det'
                ) THEN
                    ALTER TABLE "Multas_IT_Elementos_Esenciales_Det" 
                    ADD CONSTRAINT fk_multas_it_det_cab 
                    FOREIGN KEY ("cabId") REFERENCES "Multas_IT_Elementos_Esenciales_Cab"("id") ON DELETE CASCADE;
                END IF;
            END $$;
        `)

        await rawPrisma.$executeRawUnsafe(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints 
                    WHERE constraint_name = 'fk_multas_restr_lic' 
                      AND table_name = 'Multas_Aspecto_EE_Restriccion'
                ) THEN
                    ALTER TABLE "Multas_Aspecto_EE_Restriccion" 
                    ADD CONSTRAINT fk_multas_restr_lic 
                    FOREIGN KEY ("licId") REFERENCES "Licitacion"("licId") ON DELETE CASCADE;
                END IF;
            END $$;
        `)

        await rawPrisma.$executeRawUnsafe(`
            DO $$ 
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.table_constraints 
                    WHERE constraint_name = 'fk_multas_param_lic' 
                      AND table_name = 'Multas_Parametros_Licitacion'
                ) THEN
                    ALTER TABLE "Multas_Parametros_Licitacion" 
                    ADD CONSTRAINT fk_multas_param_lic 
                    FOREIGN KEY ("licId") REFERENCES "Licitacion"("licId") ON DELETE CASCADE;
                END IF;
            END $$;
        `)

        isInitialized = true
    } catch (error) {
        console.error('Error al inicializar tablas Multas EE:', error)
    }
}

