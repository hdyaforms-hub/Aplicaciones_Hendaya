import { rawPrisma } from '@/lib/prisma'

let initialized = false

/**
 * Mecanismo de auto-recuperación y creación idempotente de tablas para Dotación de Personal.
 * Cumple con la regla de resguardo de datos y creación física sin migraciones destructivas.
 */
export async function ensurePersonalDotacionTables() {
    if (initialized) return
    try {
        // 1. Tabla de Historial/Control de Cargas: Pers_Dota_Carga
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Pers_Dota_Carga" (
                id TEXT PRIMARY KEY,
                "nombreArchivo" TEXT NOT NULL,
                "totalRegistros" INTEGER NOT NULL DEFAULT 0,
                "cargadoPor" TEXT NOT NULL,
                "cargadoPorId" TEXT,
                "fechaCarga" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                observaciones TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        // 2. Tabla Principal de Dotación: Pers_Dota_Registro
        // Almacena datos personales encriptados y metadatos operativos
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Pers_Dota_Registro" (
                id TEXT PRIMARY KEY,
                "cargaId" TEXT,
                "rutEnc" TEXT NOT NULL,
                "rutHash" TEXT NOT NULL,
                "nombreEnc" TEXT NOT NULL,
                "sexoEnc" TEXT,
                "fechaNacimientoEnc" TEXT,
                "estadoCivilEnc" TEXT,
                "paisEnc" TEXT,
                "direccionEnc" TEXT,
                "comunaEnc" TEXT,
                "villaPoblacionEnc" TEXT,
                "bloqueEnc" TEXT,
                "ciudadEnc" TEXT,
                "codPostalEnc" TEXT,
                "regionEnc" TEXT,
                "telefonoEnc" TEXT,
                "correoElectronicoEnc" TEXT,
                "bancoEnc" TEXT,
                "cuentaBancoEnc" TEXT,
                rbd INTEGER,
                "rbdRaw" TEXT,
                establecimiento TEXT,
                sucursal TEXT,
                "centroDistribucion" TEXT,
                cargo TEXT,
                area TEXT,
                supervisor TEXT,
                empresa TEXT,
                "tipoContrato" TEXT,
                "fechaInicioContrato" TEXT,
                "fechaTerminoContrato" TEXT,
                "estadoContrato" TEXT,
                "horasSemanales" TEXT,
                situacion TEXT,
                afp TEXT,
                isapre TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        // 3. Índices de aceleración de consultas
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_dota_reg_rbd_idx" ON "Pers_Dota_Registro"(rbd);`)
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_dota_reg_ruthash_idx" ON "Pers_Dota_Registro"("rutHash");`)
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_dota_reg_sucursal_idx" ON "Pers_Dota_Registro"(sucursal);`)
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_dota_reg_cargo_idx" ON "Pers_Dota_Registro"(cargo);`)
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_dota_reg_carga_idx" ON "Pers_Dota_Registro"("cargaId");`)

        initialized = true
    } catch (error) {
        console.error('Error during ensurePersonalDotacionTables self-healing:', error)
    }
}
