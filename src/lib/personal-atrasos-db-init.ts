import { rawPrisma } from '@/lib/prisma'

let initialized = false

/**
 * Mecanismo de auto-recuperación y creación idempotente de tablas para Atrasos y Adelantos de Personal (Pers_Atrasos_).
 * Cumple con la regla de resguardo absoluto de datos en producción y creación física sin migraciones destructivas.
 */
export async function ensurePersonalAtrasosTables() {
    if (initialized) return
    try {
        // 1. Tabla de Historial/Control de Cargas: Pers_Atrasos_Carga
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Pers_Atrasos_Carga" (
                id TEXT PRIMARY KEY,
                "nombreArchivo" TEXT NOT NULL,
                "totalRegistros" INTEGER NOT NULL DEFAULT 0,
                nuevos INTEGER NOT NULL DEFAULT 0,
                actualizados INTEGER NOT NULL DEFAULT 0,
                "cargadoPor" TEXT NOT NULL,
                "cargadoPorId" TEXT,
                "fechaCarga" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                observaciones TEXT,
                estado TEXT NOT NULL DEFAULT 'ABIERTO',
                "cerradoPor" TEXT,
                "cerradoAt" TIMESTAMP(3),
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        // 2. Tabla Principal de Atrasos y Adelantos: Pers_Atrasos_Registro
        // Guarda Apellidos, Nombre e Identificador (RUT) encriptados con AES-256-GCM
        // Garantiza que no se dupliquen registros mediante la clave compuesta (identificadorHash, fecha)
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Pers_Atrasos_Registro" (
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
                sucursal TEXT NOT NULL DEFAULT 'CASA MATRIZ',
                supervisor TEXT,
                cargo TEXT,
                turno TEXT,
                marco TEXT,
                entro TEXT,
                salio TEXT,
                "salioTurno" TEXT,
                "horaFinTurno" TEXT,
                "minutosAtraso" DOUBLE PRECISION DEFAULT 0,
                "minutosAdelanto" DOUBLE PRECISION DEFAULT 0,
                "minutosJustificados" DOUBLE PRECISION DEFAULT 0,
                "horasAtraso" TEXT,
                "horasAdelanto" TEXT,
                justificado TEXT,
                "justificadoPor" TEXT,
                "centroCostos" TEXT,
                "grupoUsuario" TEXT,
                "aplicaDescuento" BOOLEAN NOT NULL DEFAULT false,
                "aplicaModificadoPor" TEXT,
                "aplicaModificadoAt" TIMESTAMP(3),
                observacion TEXT,
                estado TEXT NOT NULL DEFAULT 'ABIERTO',
                "cerradoPor" TEXT,
                "cerradoAt" TIMESTAMP(3),
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        // 2.b. Auto-recuperación idempotente para añadir columnas nuevas si la tabla ya existía
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Pers_Atrasos_Registro" ADD COLUMN IF NOT EXISTS "horaFinTurno" TEXT;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Pers_Atrasos_Registro" ADD COLUMN IF NOT EXISTS "minutosJustificados" DOUBLE PRECISION DEFAULT 0;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Pers_Atrasos_Registro" ADD COLUMN IF NOT EXISTS "justificadoPor" TEXT;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Pers_Atrasos_Registro" ADD COLUMN IF NOT EXISTS "centroCostos" TEXT;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Pers_Atrasos_Registro" ADD COLUMN IF NOT EXISTS "grupoUsuario" TEXT;`)

        // 3. Índice Único para upsert estricto: evita cargas duplicadas y actualiza registros por (identificadorHash, fecha)
        await rawPrisma.$executeRawUnsafe(`
            CREATE UNIQUE INDEX IF NOT EXISTS "pers_atrasos_reg_id_fecha_unique" 
            ON "Pers_Atrasos_Registro"("identificadorHash", fecha);
        `)

        // 4. Índices de aceleración de consultas
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_atrasos_reg_id_hash_idx" ON "Pers_Atrasos_Registro"("identificadorHash");`)
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_atrasos_reg_fecha_idx" ON "Pers_Atrasos_Registro"(fecha);`)
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_atrasos_reg_rbd_idx" ON "Pers_Atrasos_Registro"(rbd);`)
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_atrasos_reg_sucursal_idx" ON "Pers_Atrasos_Registro"(sucursal);`)
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_atrasos_reg_supervisor_idx" ON "Pers_Atrasos_Registro"(supervisor);`)
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_atrasos_reg_carga_idx" ON "Pers_Atrasos_Registro"("cargaId");`)
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_atrasos_reg_estado_idx" ON "Pers_Atrasos_Registro"(estado);`)
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_atrasos_reg_aplica_idx" ON "Pers_Atrasos_Registro"("aplicaDescuento");`)
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_atrasos_carga_estado_idx" ON "Pers_Atrasos_Carga"(estado);`)

        // 5. Auto-asignación de permisos a roles Administrador / Gerencia
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
                'manage_personal_atrasos_carga',
                'view_personal_atrasos',
                'manage_personal_atrasos_admin'
            ]

            for (const r of adminRoles) {
                let currentPerms: string[] = []
                try {
                    currentPerms = typeof r.permissions === 'string' ? JSON.parse(r.permissions) : (Array.isArray(r.permissions) ? r.permissions : [])
                } catch {
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
            console.error('Error auto-asignando permisos de atrasos y adelantos:', roleErr)
        }

        initialized = true
    } catch (error) {
        console.error('Error during ensurePersonalAtrasosTables self-healing:', error)
    }
}
