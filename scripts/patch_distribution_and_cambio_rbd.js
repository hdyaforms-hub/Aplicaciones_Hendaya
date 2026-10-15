/**
 * Script de inicialización y parche idempotente para Producción.
 * - Añade columna porSucursal en ListaCorreo si no existe.
 * - Añade columnas condicionales en NotificacionPantalla si no existen.
 * - Crea tabla Pers_Cambio_Rbd con sus índices si no existen.
 * 
 * Regla: Resguardo absoluto de datos existentes, sin DROP TABLE ni migraciones destructivas.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Iniciando verificación e inicialización idempotente ---');

    try {
        console.log('1. Verificando columnas en NotificacionPantalla...');
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "NotificacionPantalla" 
            ADD COLUMN IF NOT EXISTS "condicionTag" TEXT,
            ADD COLUMN IF NOT EXISTS "condicionOperador" TEXT DEFAULT 'ALWAYS',
            ADD COLUMN IF NOT EXISTS "condicionValor" TEXT;
        `);
        console.log('✓ Columnas NotificacionPantalla aseguradas.');

        console.log('2. Verificando columna porSucursal en ListaCorreo...');
        await prisma.$executeRawUnsafe(`
            ALTER TABLE "ListaCorreo" 
            ADD COLUMN IF NOT EXISTS "porSucursal" TEXT;
        `);
        console.log('✓ Columna porSucursal asegurada en ListaCorreo.');

        console.log('3. Verificando tabla Pers_Cambio_Rbd...');
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Pers_Cambio_Rbd" (
                id TEXT PRIMARY KEY,
                "colaboradorId" TEXT,
                "rutEnc" TEXT NOT NULL,
                "rutHash" TEXT NOT NULL,
                "nombreEnc" TEXT NOT NULL,
                "rbdOrigen" INTEGER NOT NULL,
                "establecimientoOrigen" TEXT,
                "sucursalOrigen" TEXT,
                supervisor TEXT,
                "rbdDestino" INTEGER NOT NULL,
                "establecimientoDestino" TEXT NOT NULL,
                "sucursalDestino" TEXT,
                "tipoCambio" TEXT NOT NULL,
                "fechaDesde" TEXT NOT NULL,
                "fechaHasta" TEXT,
                observacion TEXT,
                estado TEXT NOT NULL DEFAULT 'REGISTRADO',
                "creadoPor" TEXT NOT NULL,
                "creadoPorId" TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_cambio_rbd_origen_idx" ON "Pers_Cambio_Rbd"("rbdOrigen");`);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_cambio_rbd_destino_idx" ON "Pers_Cambio_Rbd"("rbdDestino");`);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_cambio_rbd_ruthash_idx" ON "Pers_Cambio_Rbd"("rutHash");`);
        console.log('✓ Tabla Pers_Cambio_Rbd e índices asegurados.');

        console.log('--- Parche aplicado con éxito de forma 100% segura ---');
    } catch (e) {
        console.error('Error aplicando parche:', e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
