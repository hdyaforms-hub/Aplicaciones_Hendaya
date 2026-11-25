import { rawPrisma } from '@/lib/prisma'

let initialized = false

/**
 * Inicializador idempotente y auto-recuperable de las tablas del módulo Calidad:
 * - Calidad_Motivo_C8 (Mantenedor de Motivos C8 para Registros Globales)
 * - Calidad_Acta_C8 (Actas C8 de Calidad e Inocuidad)
 * 
 * Sigue la regla de no migraciones destructivas y resguardo en producción.
 */
export async function ensureCalidadC8Tables(): Promise<void> {
    if (initialized) return

    try {
        // 1. Tabla Mantenedor de Motivos C8
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Calidad_Motivo_C8" (
                "id" TEXT PRIMARY KEY,
                "codigo" VARCHAR(50) NOT NULL UNIQUE,
                "nombre" VARCHAR(255) NOT NULL,
                "descripcion" TEXT,
                "activo" BOOLEAN NOT NULL DEFAULT TRUE,
                "creadoPor" VARCHAR(100) NOT NULL,
                "actualizadoPor" VARCHAR(100),
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "Calidad_Motivo_C8_codigo_idx"
            ON "Calidad_Motivo_C8" ("codigo");
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "Calidad_Motivo_C8_activo_idx"
            ON "Calidad_Motivo_C8" ("activo");
        `)

        // 2. Tabla de Actas C8
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Calidad_Acta_C8" (
                "id" TEXT PRIMARY KEY,
                "licitacion" VARCHAR(100) NOT NULL,
                "fechaNotificacion" TIMESTAMP(3) NOT NULL,
                "horaNotificacion" VARCHAR(20),
                "fechaHallazgo" TIMESTAMP(3) NOT NULL,
                "sucursal" VARCHAR(100) NOT NULL,
                "rbd" INTEGER NOT NULL,
                "establecimiento" VARCHAR(255) NOT NULL,
                "preparacionProducto" TEXT,
                "hallazgo" TEXT NOT NULL,
                "motivoGenericoId" TEXT,
                "motivoGenericoTexto" VARCHAR(255),
                "proveedor" TEXT,
                "institucion" VARCHAR(100) NOT NULL,
                "fechaTrazabilidad" TIMESTAMP(3),
                "horaTrazabilidad" VARCHAR(20),
                "fechaRespuestaCausa" TIMESTAMP(3),
                "horaRespuestaCausa" VARCHAR(20),
                "enviaReclamoProveedor" BOOLEAN NOT NULL DEFAULT FALSE,
                "multaEstimadaUtm" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                "respaldoAccion1" TEXT,
                "respaldoAccion2" TEXT,
                "respaldoAccion3" TEXT,
                "respaldoAccion4" TEXT,
                "observacion" TEXT,
                "mesNotificacion" INTEGER NOT NULL,
                "anioNotificacion" INTEGER NOT NULL,
                "montoUtmPesos" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                "calculoPesosUtm" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                "aplicaC8" BOOLEAN NOT NULL DEFAULT TRUE,
                "calidadOInocuidad" VARCHAR(30) DEFAULT 'Calidad',
                "eficacia" VARCHAR(255),
                "respuestaInstitucion" TEXT,
                "creadoPor" VARCHAR(100) NOT NULL,
                "actualizadoPor" VARCHAR(100),
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "idx_calidad_acta_c8_rbd"
            ON "Calidad_Acta_C8" ("rbd");
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "idx_calidad_acta_c8_licitacion"
            ON "Calidad_Acta_C8" ("licitacion");
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "idx_calidad_acta_c8_sucursal"
            ON "Calidad_Acta_C8" ("sucursal");
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "idx_calidad_acta_c8_anio_mes"
            ON "Calidad_Acta_C8" ("anioNotificacion", "mesNotificacion");
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "idx_calidad_acta_c8_fecha_notif"
            ON "Calidad_Acta_C8" ("fechaNotificacion");
        `)

        // Columnas adicionales idempotentes en Calidad_Acta_C8
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Calidad_Acta_C8" ADD COLUMN IF NOT EXISTS "folio" VARCHAR(100);`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Calidad_Acta_C8" ADD COLUMN IF NOT EXISTS "tipoMulta" VARCHAR(50);`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Calidad_Acta_C8" ADD COLUMN IF NOT EXISTS "aprobadoInstitucion" BOOLEAN DEFAULT FALSE;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Calidad_Acta_C8" ADD COLUMN IF NOT EXISTS "aprobadorCorreo" VARCHAR(150);`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Calidad_Acta_C8" ADD COLUMN IF NOT EXISTS "aprobadorNombre" VARCHAR(150);`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Calidad_Acta_C8" ADD COLUMN IF NOT EXISTS "aprobadorFecha" TIMESTAMP(3);`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Calidad_Acta_C8" ADD COLUMN IF NOT EXISTS "aprobadorDocUrl" TEXT;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Calidad_Acta_C8" ADD COLUMN IF NOT EXISTS "aprobadorDocNombre" VARCHAR(255);`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Calidad_Acta_C8" ADD COLUMN IF NOT EXISTS "valorAnualContrato" DOUBLE PRECISION DEFAULT 0.0;`)

        // 3. Tabla de Valor Anual del Contrato (Mantenedor Registros Globales)
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Calidad_Valor_Contrato" (
                "id" TEXT PRIMARY KEY,
                "licitacion" VARCHAR(100) NOT NULL,
                "anio" INTEGER NOT NULL,
                "montoAnualPesos" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                "descripcion" TEXT,
                "activo" BOOLEAN NOT NULL DEFAULT TRUE,
                "creadoPor" VARCHAR(100) NOT NULL,
                "actualizadoPor" VARCHAR(100),
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE UNIQUE INDEX IF NOT EXISTS "Calidad_Valor_Contrato_lic_anio_idx"
            ON "Calidad_Valor_Contrato" ("licitacion", "anio");
        `)

        // Sembrado inicial de motivos estándar si la tabla está vacía
        const count = await rawPrisma.$queryRawUnsafe<{ count: string | number }[]>(
            `SELECT COUNT(*)::text as count FROM "Calidad_Motivo_C8";`
        )
        const total = Number(count[0]?.count || 0)

        if (total === 0) {
            const defaultMotivos = [
                { codigo: 'C8-EXTRANEO', nombre: 'Presencia de Cuerpo Extraño', descripcion: 'Detección de objetos o materias extrañas en raciones o materias primas' },
                { codigo: 'C8-TEMP', nombre: 'Temperatura Inadecuada', descripcion: 'Desviación en temperatura de cocción, mantención, refrigeración o transporte' },
                { codigo: 'C8-ORGANO', nombre: 'Alteración Organoléptica', descripcion: 'Olor, sabor, color o textura no conforme con la especificación técnica' },
                { codigo: 'C8-ROTULO', nombre: 'Problema de Rotulación o Vencimiento', descripcion: 'Producto sin rotular, fecha ilegible, caducada o vencida' },
                { codigo: 'C8-INOCUIDAD', nombre: 'Riesgo de Inocuidad Microbiológica', descripcion: 'Sospecha o confirmación de contaminación bacteriana o viral' },
                { codigo: 'C8-GRAMAJE', nombre: 'Desviación de Gramaje / Porción', descripcion: 'Porción o gramaje no acorde a la minuta programada' },
                { codigo: 'C8-HIGIENE', nombre: 'Incumplimiento de Higiene y Buenas Prácticas', descripcion: 'Falta en condiciones de manipulación, aseo o vestimenta' },
                { codigo: 'C8-OTRO', nombre: 'Otro Motivo C8', descripcion: 'Otras no conformidades clasificadas bajo aspecto C8' }
            ]

            for (const m of defaultMotivos) {
                await rawPrisma.$executeRawUnsafe(`
                    INSERT INTO "Calidad_Motivo_C8" ("id", "codigo", "nombre", "descripcion", "activo", "creadoPor")
                    VALUES (gen_random_uuid()::text, $1, $2, $3, TRUE, 'SISTEMA')
                    ON CONFLICT ("codigo") DO NOTHING;
                `, m.codigo, m.nombre, m.descripcion)
            }
        }

        initialized = true
    } catch (error) {
        console.error('Error inicializando tablas de Calidad C8:', error)
    }
}
