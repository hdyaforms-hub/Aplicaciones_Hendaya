import { rawPrisma } from '@/lib/prisma'

const DEFAULT_CRITERIOS = [
    { nombre: 'AUSENCIA', color: '#dc2626', descripcion: 'Inasistencia sin justificación reportada', orden: 1 },
    { nombre: 'LICENCIA', color: '#ea580c', descripcion: 'Licencia médica informada', orden: 2 },
    { nombre: 'NO APARECE EN GEOVICTORIA', color: '#eab308', descripcion: 'Colaborador no registrado o sin marcaje en sistema Geovictoria', orden: 3 },
    { nombre: 'PERMISO CON GOCE', color: '#16a34a', descripcion: 'Permiso autorizado con goce de remuneraciones', orden: 4 },
    { nombre: 'PERMISO DEFUNCIÓN', color: '#475569', descripcion: 'Permiso por duelo o defunción familiar', orden: 5 },
    { nombre: 'PERMISO SIN GOCE', color: '#d97706', descripcion: 'Permiso particular autorizado sin goce de sueldo', orden: 6 },
    { nombre: 'PERMISO SINDICAL', color: '#8b5cf6', descripcion: 'Permiso por gestiones de fuero o actividad sindical', orden: 7 },
    { nombre: 'REPOSO MÉDICO', color: '#0284c7', descripcion: 'Reposo o certificado médico presentado', orden: 8 },
    { nombre: 'SIN BAM', color: '#64748b', descripcion: 'Problemas de banda ancha móvil o conectividad', orden: 9 },
    { nombre: 'SIN SEÑAL', color: '#6b7280', descripcion: 'Sin señal de telecomunicaciones en el establecimiento', orden: 10 },
    { nombre: 'SIN TABLET', color: '#78716c', descripcion: 'Establecimiento sin dispositivo tablet operativo', orden: 11 },
    { nombre: 'RBD CERRADO', color: '#ef4444', descripcion: 'Establecimiento educativo cerrado o sin atención', orden: 12 },
    { nombre: 'PROBLEMAS TECNICOS TABLET', color: '#f59e0b', descripcion: 'Falla técnica o bloqueo de la aplicación en tablet', orden: 13 },
    { nombre: 'DIRIGENTA SINDICAL', color: '#a855f7', descripcion: 'Actividad oficial de dirigencia sindical', orden: 14 }
]

let initialized = false

export async function ensurePersonalAsistenciaTables() {
    if (initialized) return
    try {
        // 1. Pers_Asis_Criterio
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Pers_Asis_Criterio" (
                id TEXT PRIMARY KEY,
                nombre TEXT NOT NULL UNIQUE,
                descripcion TEXT,
                color TEXT DEFAULT '#0891b2',
                activo BOOLEAN NOT NULL DEFAULT true,
                "solicitaDocumento" BOOLEAN NOT NULL DEFAULT false,
                orden INTEGER NOT NULL DEFAULT 0,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        // 2. Pers_Asis_Carga
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Pers_Asis_Carga" (
                id TEXT PRIMARY KEY,
                "nombreArchivo" TEXT NOT NULL,
                "totalRegistros" INTEGER NOT NULL DEFAULT 0,
                "nuevosRegistros" INTEGER NOT NULL DEFAULT 0,
                "actualizadosRegistros" INTEGER NOT NULL DEFAULT 0,
                "erroresRegistros" INTEGER NOT NULL DEFAULT 0,
                "cargadoPor" TEXT NOT NULL,
                "cargadoPorId" TEXT,
                "fechaCarga" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "actualizadoPor" TEXT,
                "actualizadoPorId" TEXT,
                "ultimaActualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                observaciones TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        // 3. Pers_Asis_Registro
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Pers_Asis_Registro" (
                id TEXT PRIMARY KEY,
                "cargaId" TEXT,
                "rutEnc" TEXT NOT NULL,
                "rutHash" TEXT NOT NULL,
                "apellidosEnc" TEXT NOT NULL,
                "nombreEnc" TEXT NOT NULL,
                fecha TEXT NOT NULL,
                rbd INTEGER NOT NULL,
                establecimiento TEXT NOT NULL,
                "grupoOriginal" TEXT,
                cargo TEXT,
                "permisoParcial" TEXT,
                "criterioId" TEXT,
                "criterioNombre" TEXT,
                "criterioObservacion" TEXT,
                "criterioAsignadoPor" TEXT,
                "criterioAsignadoAt" TIMESTAMP(3),
                "documentoUrl" TEXT,
                "documentoNombre" TEXT,
                "documentoSubidoAt" TIMESTAMP(3),
                "documentoSubidoPor" TEXT,
                "creadoPor" TEXT NOT NULL,
                "creadoPorId" TEXT,
                "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "actualizadoPor" TEXT,
                "actualizadoPorId" TEXT,
                "fechaActualizacion" TIMESTAMP(3),
                "numActualizaciones" INTEGER NOT NULL DEFAULT 0,
                "historialActualizaciones" TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        // Auto-migraciones idempotentes para columnas nuevas
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Pers_Asis_Criterio" ADD COLUMN IF NOT EXISTS "solicitaDocumento" BOOLEAN NOT NULL DEFAULT false;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Pers_Asis_Registro" ADD COLUMN IF NOT EXISTS "documentoUrl" TEXT;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Pers_Asis_Registro" ADD COLUMN IF NOT EXISTS "documentoNombre" TEXT;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Pers_Asis_Registro" ADD COLUMN IF NOT EXISTS "documentoSubidoAt" TIMESTAMP(3);`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Pers_Asis_Registro" ADD COLUMN IF NOT EXISTS "documentoSubidoPor" TEXT;`)

        // Índices y restricciones
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_asis_reg_rbd_idx" ON "Pers_Asis_Registro"(rbd);`)
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_asis_reg_fecha_idx" ON "Pers_Asis_Registro"(fecha);`)
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_asis_reg_ruthash_idx" ON "Pers_Asis_Registro"("rutHash");`)
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_asis_reg_criterio_idx" ON "Pers_Asis_Registro"("criterioId");`)
        await rawPrisma.$executeRawUnsafe(`
            CREATE UNIQUE INDEX IF NOT EXISTS "pers_asis_reg_unique_rut_fecha_rbd" 
            ON "Pers_Asis_Registro"("rutHash", fecha, rbd);
        `)

        // Seed de criterios por defecto si no existen
        for (const crit of DEFAULT_CRITERIOS) {
            await rawPrisma.$executeRawUnsafe(`
                INSERT INTO "Pers_Asis_Criterio" (id, nombre, color, descripcion, orden, activo, "createdAt", "updatedAt")
                VALUES (gen_random_uuid()::text, $1, $2, $3, $4, true, NOW(), NOW())
                ON CONFLICT (nombre) DO UPDATE SET
                    color = EXCLUDED.color,
                    descripcion = COALESCE("Pers_Asis_Criterio".descripcion, EXCLUDED.descripcion);
            `, crit.nombre, crit.color, crit.descripcion, crit.orden)
        }

        // Auto-reparación idempotente: si existen registros donde rbd = 0 y el grupo contenía dígito verificador
        try {
            await rawPrisma.$executeRawUnsafe(`
                UPDATE "Pers_Asis_Registro"
                SET 
                    rbd = (substring("grupoOriginal" from '\\(?([0-9]+)(?:-[0-9kK])?\\)?'))::integer,
                    establecimiento = NULLIF(TRIM(regexp_replace("grupoOriginal", '^\\s*\\([0-9]+(?:-[0-9kK])?\\)\\s*', '')), '')
                WHERE rbd = 0 
                  AND "grupoOriginal" ~ '\\(?([0-9]+)(?:-[0-9kK])?\\)?';
            `)
        } catch {
            // Silencioso si no aplica
        }

        initialized = true
    } catch (error) {
        console.error('Error during ensurePersonalAsistenciaTables self-healing:', error)
    }
}
