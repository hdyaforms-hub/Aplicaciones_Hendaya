import { rawPrisma } from '@/lib/prisma'

let initialized = false

/**
 * Inicializador idempotente y auto-recuperable (self-healing)
 * para la configuración de visualización y asignación de personal a jefaturas.
 * Cumple con las directrices del proyecto:
 * 1. CREATE TABLE IF NOT EXISTS (sin migraciones destructivas).
 * 2. Preservación absoluta de datos existentes en producción.
 */
export async function ensurePersonalVisualizacionTables() {
    if (initialized) return
    try {
        // 1. Tabla de asignaciones entre Jefatura (Usuario o Rol) y Personal de Dotación
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Pers_Visualizacion_Jefatura" (
                "id" TEXT PRIMARY KEY,
                "tipo" TEXT NOT NULL DEFAULT 'USUARIO', -- 'USUARIO' | 'ROL'
                "jefaturaUserId" TEXT,
                "jefaturaRoleId" TEXT,
                "jefaturaNombre" TEXT NOT NULL,
                "jefaturaUsername" TEXT,
                "jefaturaEmail" TEXT,
                "personalRutHash" TEXT NOT NULL,
                "personalRutEnc" TEXT NOT NULL,
                "personalNombreEnc" TEXT NOT NULL,
                "personalCargo" TEXT,
                "personalRbd" INTEGER,
                "personalEstablecimiento" TEXT,
                "personalSucursal" TEXT,
                "asignadoPor" TEXT NOT NULL,
                "asignadoPorId" TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        // 2. Índices para acelerar búsquedas y consultas
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_vis_jef_tipo_idx" ON "Pers_Visualizacion_Jefatura"("tipo");`)
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_vis_jef_user_idx" ON "Pers_Visualizacion_Jefatura"("jefaturaUserId");`)
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_vis_jef_role_idx" ON "Pers_Visualizacion_Jefatura"("jefaturaRoleId");`)
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_vis_jef_ruthash_idx" ON "Pers_Visualizacion_Jefatura"("personalRutHash");`)
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_vis_jef_rbd_idx" ON "Pers_Visualizacion_Jefatura"("personalRbd");`)

        // 3. Índices únicos condicionales para evitar duplicidad de asignación exacta
        await rawPrisma.$executeRawUnsafe(`
            CREATE UNIQUE INDEX IF NOT EXISTS "pers_vis_jef_user_ruthash_uq" 
            ON "Pers_Visualizacion_Jefatura" ("jefaturaUserId", "personalRutHash") 
            WHERE "tipo" = 'USUARIO';
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE UNIQUE INDEX IF NOT EXISTS "pers_vis_jef_role_ruthash_uq" 
            ON "Pers_Visualizacion_Jefatura" ("jefaturaRoleId", "personalRutHash") 
            WHERE "tipo" = 'ROL';
        `)

        initialized = true
    } catch (error) {
        console.error('Error al inicializar tablas de Pers_Visualizacion_Jefatura (self-healing):', error)
    }
}
