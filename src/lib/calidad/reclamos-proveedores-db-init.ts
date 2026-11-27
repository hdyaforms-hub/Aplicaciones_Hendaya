import { rawPrisma } from '@/lib/prisma'

let initialized = false

export async function ensureReclamosProveedoresTables(): Promise<void> {
    if (initialized) return

    try {
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "calidad_reclamos_proveedores" (
                "id" TEXT PRIMARY KEY,
                "numeroReclamo" VARCHAR(20) NOT NULL UNIQUE,
                "correlativo" INTEGER NOT NULL,
                "anio" INTEGER NOT NULL,
                "licitacionId" VARCHAR(50) NOT NULL,
                "licitacionNombre" VARCHAR(150) NOT NULL,
                "zonal" VARCHAR(100) NOT NULL,
                "origenReclamo" VARCHAR(50) NOT NULL,
                "fechaDesviacion" DATE NOT NULL,
                "lugar" VARCHAR(200) NOT NULL,
                "tipoReclamo" VARCHAR(30) NOT NULL,
                "producto" VARCHAR(200) NOT NULL,
                "proveedor" VARCHAR(200) NOT NULL,
                "marca" VARCHAR(150),
                "fechaElaboracion" DATE,
                "fechaVencimiento" DATE,
                "lote" VARCHAR(100),
                "formato" VARCHAR(100),
                "cantidad" NUMERIC(12, 2),
                "formatoCantidad" VARCHAR(20),
                "observacion" TEXT,
                "evidencias" TEXT NOT NULL DEFAULT '[]',
                "fechaRecepcionReclamo" DATE,
                "fechaEnvioProveedor" DATE,
                "fechaRecepcionRespuesta" DATE,
                "estado" VARCHAR(30) NOT NULL DEFAULT 'ABIERTO',
                "creadoPor" VARCHAR(100) NOT NULL,
                "creadoPorNombre" VARCHAR(150),
                "actualizadoPor" VARCHAR(100),
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        // Columnas idempotentes por si la tabla ya existía
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "calidad_reclamos_proveedores" ADD COLUMN IF NOT EXISTS "numeroReclamo" VARCHAR(20);`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "calidad_reclamos_proveedores" ADD COLUMN IF NOT EXISTS "correlativo" INTEGER;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "calidad_reclamos_proveedores" ADD COLUMN IF NOT EXISTS "anio" INTEGER;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "calidad_reclamos_proveedores" ADD COLUMN IF NOT EXISTS "licitacionId" VARCHAR(50);`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "calidad_reclamos_proveedores" ADD COLUMN IF NOT EXISTS "licitacionNombre" VARCHAR(150);`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "calidad_reclamos_proveedores" ADD COLUMN IF NOT EXISTS "zonal" VARCHAR(100);`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "calidad_reclamos_proveedores" ADD COLUMN IF NOT EXISTS "origenReclamo" VARCHAR(50);`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "calidad_reclamos_proveedores" ALTER COLUMN "origenReclamo" TYPE VARCHAR(50);`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "calidad_reclamos_proveedores" ADD COLUMN IF NOT EXISTS "fechaDesviacion" DATE;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "calidad_reclamos_proveedores" ADD COLUMN IF NOT EXISTS "lugar" VARCHAR(200);`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "calidad_reclamos_proveedores" ADD COLUMN IF NOT EXISTS "tipoReclamo" VARCHAR(30);`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "calidad_reclamos_proveedores" ADD COLUMN IF NOT EXISTS "producto" VARCHAR(200);`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "calidad_reclamos_proveedores" ADD COLUMN IF NOT EXISTS "proveedor" VARCHAR(200);`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "calidad_reclamos_proveedores" ADD COLUMN IF NOT EXISTS "marca" VARCHAR(150);`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "calidad_reclamos_proveedores" ADD COLUMN IF NOT EXISTS "fechaElaboracion" DATE;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "calidad_reclamos_proveedores" ADD COLUMN IF NOT EXISTS "fechaVencimiento" DATE;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "calidad_reclamos_proveedores" ADD COLUMN IF NOT EXISTS "lote" VARCHAR(100);`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "calidad_reclamos_proveedores" ADD COLUMN IF NOT EXISTS "formato" VARCHAR(100);`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "calidad_reclamos_proveedores" ADD COLUMN IF NOT EXISTS "cantidad" NUMERIC(12, 2);`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "calidad_reclamos_proveedores" ADD COLUMN IF NOT EXISTS "formatoCantidad" VARCHAR(20);`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "calidad_reclamos_proveedores" ADD COLUMN IF NOT EXISTS "observacion" TEXT;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "calidad_reclamos_proveedores" ADD COLUMN IF NOT EXISTS "evidencias" TEXT DEFAULT '[]';`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "calidad_reclamos_proveedores" ADD COLUMN IF NOT EXISTS "fechaRecepcionReclamo" DATE;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "calidad_reclamos_proveedores" ADD COLUMN IF NOT EXISTS "fechaEnvioProveedor" DATE;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "calidad_reclamos_proveedores" ADD COLUMN IF NOT EXISTS "fechaRecepcionRespuesta" DATE;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "calidad_reclamos_proveedores" ADD COLUMN IF NOT EXISTS "estado" VARCHAR(30) DEFAULT 'ABIERTO';`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "calidad_reclamos_proveedores" ADD COLUMN IF NOT EXISTS "creadoPor" VARCHAR(100);`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "calidad_reclamos_proveedores" ADD COLUMN IF NOT EXISTS "creadoPorNombre" VARCHAR(150);`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "calidad_reclamos_proveedores" ADD COLUMN IF NOT EXISTS "actualizadoPor" VARCHAR(100);`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "calidad_reclamos_proveedores" ADD COLUMN IF NOT EXISTS "archivoRespuesta" TEXT;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "calidad_reclamos_proveedores" ADD COLUMN IF NOT EXISTS "destinoCompras" VARCHAR(50);`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "calidad_reclamos_proveedores" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "calidad_reclamos_proveedores" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;`)

        // Tabla de Privilegios Especiales por Usuario sobre Reclamos a Proveedores
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "calidad_reclamos_privilegios_usuarios" (
                "id" TEXT PRIMARY KEY,
                "userId" VARCHAR(100) NOT NULL UNIQUE,
                "username" VARCHAR(150) NOT NULL,
                "nombreCompleto" VARCHAR(200),
                "puedeEditar" BOOLEAN NOT NULL DEFAULT FALSE,
                "puedeFechasSeguimiento" BOOLEAN NOT NULL DEFAULT FALSE,
                "puedeAdjuntarRespuesta" BOOLEAN NOT NULL DEFAULT FALSE,
                "actualizadoPor" VARCHAR(100),
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "calidad_reclamos_privilegios_usuarios" ADD COLUMN IF NOT EXISTS "puedeEditar" BOOLEAN DEFAULT FALSE;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "calidad_reclamos_privilegios_usuarios" ADD COLUMN IF NOT EXISTS "puedeFechasSeguimiento" BOOLEAN DEFAULT FALSE;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "calidad_reclamos_privilegios_usuarios" ADD COLUMN IF NOT EXISTS "puedeAdjuntarRespuesta" BOOLEAN DEFAULT FALSE;`)

        // Índices para rendimiento de búsqueda y ordenamiento
        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "idx_calidad_reclamos_anio_correlativo"
            ON "calidad_reclamos_proveedores" ("anio", "correlativo");
        `)
        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "idx_calidad_reclamos_licitacion_fecha"
            ON "calidad_reclamos_proveedores" ("licitacionId", "fechaDesviacion");
        `)

        initialized = true
    } catch (error) {
        console.error('[ensureReclamosProveedoresTables] Error inicializando tablas:', error)
        throw error
    }
}
