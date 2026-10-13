import { rawPrisma } from '@/lib/prisma'

let initialized = false

/**
 * Mecanismo de auto-recuperación y creación idempotente de tablas para Horas Extras de Personal (Pers_Hextra_).
 * Cumple con la regla de resguardo de datos en producción y creación física sin migraciones destructivas.
 */
export async function ensurePersonalHextraTables() {
    if (initialized) return
    try {
        // 1. Tabla de Historial/Control de Cargas: Pers_Hextra_Carga
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Pers_Hextra_Carga" (
                id TEXT PRIMARY KEY,
                "nombreArchivo" TEXT NOT NULL,
                "totalRegistros" INTEGER NOT NULL DEFAULT 0,
                "nuevos" INTEGER NOT NULL DEFAULT 0,
                "actualizados" INTEGER NOT NULL DEFAULT 0,
                "cargadoPor" TEXT NOT NULL,
                "cargadoPorId" TEXT,
                "fechaCarga" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                observaciones TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        // 2. Tabla Principal de Horas Extras: Pers_Hextra_Registro
        // Guarda Apellidos, Nombre e Identificador encriptados con AES-256-GCM
        // Garantiza que no se dupliquen registros mediante la clave compuesta (identificadorHash, fecha)
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Pers_Hextra_Registro" (
                id TEXT PRIMARY KEY,
                "cargaId" TEXT,
                "identificadorEnc" TEXT NOT NULL,
                "identificadorHash" TEXT NOT NULL,
                "apellidosEnc" TEXT NOT NULL,
                "nombreEnc" TEXT NOT NULL,
                fecha TEXT NOT NULL,
                "fechaSerial" TEXT,
                rbd INTEGER,
                "rbdRaw" TEXT,
                establecimiento TEXT,
                institucion TEXT,
                "sedeRaw" TEXT,
                sucursal TEXT NOT NULL,
                supervisor TEXT,
                turno TEXT,
                marco TEXT,
                "salioTurno" TEXT,
                entro TEXT,
                atraso DOUBLE PRECISION DEFAULT 0,
                justificado TEXT,
                salio TEXT,
                hhee DOUBLE PRECISION DEFAULT 0,
                "hheeAtraso" DOUBLE PRECISION DEFAULT 0,
                "hheeRex" DOUBLE PRECISION DEFAULT 0,
                "montoPagar" DOUBLE PRECISION DEFAULT 0,
                cargo TEXT,
                "horasTotales" TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        // 3. Índice Único para upsert estricto: evita cargas n veces y actualiza registros por (identificadorHash, fecha)
        await rawPrisma.$executeRawUnsafe(`
            CREATE UNIQUE INDEX IF NOT EXISTS "pers_hextra_reg_id_fecha_unique" 
            ON "Pers_Hextra_Registro"("identificadorHash", fecha);
        `)

        // 4. Índices de aceleración de consultas
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_hextra_reg_id_hash_idx" ON "Pers_Hextra_Registro"("identificadorHash");`)
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_hextra_reg_fecha_idx" ON "Pers_Hextra_Registro"(fecha);`)
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_hextra_reg_rbd_idx" ON "Pers_Hextra_Registro"(rbd);`)
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_hextra_reg_sucursal_idx" ON "Pers_Hextra_Registro"(sucursal);`)
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_hextra_reg_supervisor_idx" ON "Pers_Hextra_Registro"(supervisor);`)
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_hextra_reg_carga_idx" ON "Pers_Hextra_Registro"("cargaId");`)

        // 5. Columnas para cierre de período y control "Aplica / No aplica"
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Pers_Hextra_Carga" ADD COLUMN IF NOT EXISTS "estado" TEXT NOT NULL DEFAULT 'ABIERTO';`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Pers_Hextra_Carga" ADD COLUMN IF NOT EXISTS "cerradoPor" TEXT;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Pers_Hextra_Carga" ADD COLUMN IF NOT EXISTS "cerradoAt" TIMESTAMP(3);`)

        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Pers_Hextra_Registro" ADD COLUMN IF NOT EXISTS "aplica" BOOLEAN NOT NULL DEFAULT false;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Pers_Hextra_Registro" ALTER COLUMN "aplica" SET DEFAULT false;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Pers_Hextra_Registro" ADD COLUMN IF NOT EXISTS "aplicaModificadoPor" TEXT;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Pers_Hextra_Registro" ADD COLUMN IF NOT EXISTS "aplicaModificadoAt" TIMESTAMP(3);`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Pers_Hextra_Registro" ADD COLUMN IF NOT EXISTS "aplicaObservacion" TEXT;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Pers_Hextra_Registro" ADD COLUMN IF NOT EXISTS "estado" TEXT NOT NULL DEFAULT 'ABIERTO';`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Pers_Hextra_Registro" ADD COLUMN IF NOT EXISTS "cerradoPor" TEXT;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Pers_Hextra_Registro" ADD COLUMN IF NOT EXISTS "cerradoAt" TIMESTAMP(3);`)

        // Actualizar registros previos no modificados para que su valor sea No Aplica (false) por defecto
        try {
            await rawPrisma.$executeRawUnsafe(`UPDATE "Pers_Hextra_Registro" SET aplica = false WHERE "aplicaModificadoPor" IS NULL;`)
        } catch {}

        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_hextra_reg_estado_idx" ON "Pers_Hextra_Registro"(estado);`)
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_hextra_reg_aplica_idx" ON "Pers_Hextra_Registro"(aplica);`)
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_hextra_carga_estado_idx" ON "Pers_Hextra_Carga"(estado);`)

        // 6. Auto-asignación de permisos a roles Administrador / Gerencia
        try {
            const adminRoles = await rawPrisma.role.findMany({
                where: {
                    OR: [
                        { name: { contains: 'admin', mode: 'insensitive' } },
                        { name: { contains: 'gerencia', mode: 'insensitive' } }
                    ]
                }
            })

            const permisosAuto = [
                'manage_personal_horas_extras_carga',
                'view_personal_horas_extras',
                'manage_personal_horas_extras_admin'
            ]

            for (const r of adminRoles) {
                let currentPerms: string[] = []
                try {
                    currentPerms = typeof r.permissions === 'string' ? JSON.parse(r.permissions) : (Array.isArray(r.permissions) ? r.permissions : [])
                } catch (e) {
                    currentPerms = []
                }
                let modified = false
                for (const p of permisosAuto) {
                    if (!currentPerms.includes(p)) {
                        currentPerms.push(p)
                        modified = true
                    }
                }
                if (modified) {
                    await rawPrisma.role.update({
                        where: { id: r.id },
                        data: { permissions: JSON.stringify(currentPerms) }
                    })
                }
            }
        } catch (roleErr) {
            console.error('Error auto-asignando permisos de horas extras:', roleErr)
        }

        initialized = true
    } catch (error) {
        console.error('Error during ensurePersonalHextraTables self-healing:', error)
    }
}
