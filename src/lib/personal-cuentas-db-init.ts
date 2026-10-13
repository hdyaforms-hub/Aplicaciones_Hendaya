import { rawPrisma } from '@/lib/prisma'

let initialized = false

/**
 * Auto-recuperación y creación idempotente de la tabla de permisos de períodos de Recursos Humanos.
 * Cumple con la regla de creación física en producción sin migraciones destructivas.
 */
export async function ensurePersonalCuentasTables() {
    if (initialized) return
    try {
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Pers_Permiso_Periodos" (
                "userId" TEXT PRIMARY KEY,
                "puedeCerrarPeriodos" BOOLEAN NOT NULL DEFAULT false,
                "autorizadoPor" TEXT,
                "autorizadoPorId" TEXT,
                "autorizadoAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
            );
        `)
        initialized = true
    } catch (e) {
        console.error('Error initializing Pers_Permiso_Periodos table:', e)
    }
}

/**
 * Consulta si un usuario específico tiene el permiso activo para cerrar o abrir períodos en RRHH.
 */
export async function puedeUsuarioCerrarPeriodosRH(userId: string): Promise<boolean> {
    if (!userId) return false
    await ensurePersonalCuentasTables()
    try {
        const rows: any[] = await rawPrisma.$queryRawUnsafe(
            `SELECT "puedeCerrarPeriodos" FROM "Pers_Permiso_Periodos" WHERE "userId" = $1;`,
            userId
        )
        if (rows && rows.length > 0) {
            return rows[0].puedeCerrarPeriodos === true
        }
        return false
    } catch (e) {
        console.error('Error verificando permiso de períodos para usuario:', userId, e)
        return false
    }
}
