const { PrismaClient } = require('../src/generated/client')
const prisma = new PrismaClient()

async function patchResolucionSanitaria() {
    console.log('=== [Calidad] Verificando e inicializando tabla Cal_ResSan_Registro en PostgreSQL ===')

    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Cal_ResSan_Registro" (
                "id" TEXT PRIMARY KEY,
                "licitacion" TEXT,
                "licId" INTEGER,
                "anio" INTEGER NOT NULL,
                "ut" INTEGER NOT NULL,
                "institucion" TEXT NOT NULL,
                "rbd" INTEGER NOT NULL,
                "rbdDv" TEXT,
                "nombreEstablecimiento" TEXT NOT NULL,
                "sucursal" TEXT,
                "comuna" TEXT NOT NULL,
                "estadoResolucion" TEXT NOT NULL DEFAULT 'No Aplica',
                "numeroResolucion" TEXT,
                "documentoUrl" TEXT,
                "documentoNombre" TEXT,
                "observaciones" TEXT,
                "updatedBy" TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "Cal_ResSan_Registro_rbd_anio_key" UNIQUE ("rbd", "anio")
            );
        `)
        console.log('✓ Tabla Cal_ResSan_Registro verificada/creada.')

        // Asegurar que si la columna sucursal no existe, se agregue dinámicamente
        await prisma.$executeRawUnsafe(`ALTER TABLE "Cal_ResSan_Registro" ADD COLUMN IF NOT EXISTS "sucursal" TEXT;`).catch(() => {})

        // Asegurar tipos de columnas TEXT
        await prisma.$executeRawUnsafe(`ALTER TABLE "Cal_ResSan_Registro" ALTER COLUMN "institucion" TYPE TEXT;`).catch(() => {})
        await prisma.$executeRawUnsafe(`ALTER TABLE "Cal_ResSan_Registro" ALTER COLUMN "comuna" TYPE TEXT;`).catch(() => {})
        await prisma.$executeRawUnsafe(`ALTER TABLE "Cal_ResSan_Registro" ALTER COLUMN "estadoResolucion" TYPE TEXT;`).catch(() => {})
        await prisma.$executeRawUnsafe(`ALTER TABLE "Cal_ResSan_Registro" ALTER COLUMN "numeroResolucion" TYPE TEXT;`).catch(() => {})
        await prisma.$executeRawUnsafe(`ALTER TABLE "Cal_ResSan_Registro" ALTER COLUMN "rbdDv" TYPE TEXT;`).catch(() => {})
        await prisma.$executeRawUnsafe(`ALTER TABLE "Cal_ResSan_Registro" ALTER COLUMN "updatedBy" TYPE TEXT;`).catch(() => {})

        // Índices de optimización
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cal_ResSan_Registro_anio_idx" ON "Cal_ResSan_Registro"("anio");`)
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cal_ResSan_Registro_licitacion_idx" ON "Cal_ResSan_Registro"("licitacion");`)
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cal_ResSan_Registro_ut_idx" ON "Cal_ResSan_Registro"("ut");`)
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cal_ResSan_Registro_rbd_idx" ON "Cal_ResSan_Registro"("rbd");`)
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cal_ResSan_Registro_sucursal_idx" ON "Cal_ResSan_Registro"("sucursal");`)
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cal_ResSan_Registro_estadoResolucion_idx" ON "Cal_ResSan_Registro"("estadoResolucion");`)
        console.log('✓ Índices verificados/creados.')

        // Depurar sucursales ficticias
        const resDelete = await prisma.$executeRawUnsafe(`
            DELETE FROM "Cal_ResSan_Registro"
            WHERE "rbd" IN (31, 32, 1101)
               OR LOWER("nombreEstablecimiento") LIKE '%sucursal%';
        `).catch(() => 0)
        console.log('✓ Depuración de RBDs ficticios ejecutada.')

        console.log('=== Parche de Resolución Sanitaria completado con éxito ===')
    } catch (error) {
        console.error('Error durante el parche de Resolución Sanitaria:', error)
        process.exit(1)
    } finally {
        await prisma.$disconnect()
    }
}

patchResolucionSanitaria()
