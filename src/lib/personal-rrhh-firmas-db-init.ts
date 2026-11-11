import { rawPrisma } from '@/lib/prisma'

let initialized = false

/**
 * Inicialización idempotente y auto-recuperable de las tablas de Recursos Humanos para Firmas Pendientes:
 * - Pers_RRHH_Firmas_Carga: Registro de la carga de Excel más reciente
 * - Pers_RRHH_Firmas_Pendientes: Documentos con firma pendiente del personal
 */
export async function ensurePersonalRRHHFirmasTables() {
    if (initialized) return
    try {
        // 1. Tabla de Control de Cargas Masivas de Recursos Humanos
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Pers_RRHH_Firmas_Carga" (
                id TEXT PRIMARY KEY,
                "nombreArchivo" TEXT NOT NULL,
                "totalRegistros" INTEGER NOT NULL DEFAULT 0,
                "totalEmpleados" INTEGER NOT NULL DEFAULT 0,
                "cargadoPor" TEXT NOT NULL,
                "cargadoPorUserId" TEXT,
                "fechaCarga" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                observaciones TEXT
            );
        `)

        // 2. Tabla Principal de Documentos con Firma Pendiente de Recursos Humanos
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Pers_RRHH_Firmas_Pendientes" (
                id TEXT PRIMARY KEY,
                "cargaId" TEXT,
                "diasAtraso" INTEGER NOT NULL DEFAULT 0,
                "empleadoRut" TEXT NOT NULL,
                "empleadoRutLimpio" TEXT NOT NULL,
                "empleadoRutHash" TEXT NOT NULL,
                "empleadoNombre" TEXT NOT NULL,
                "nombreContrato" TEXT,
                "contrato" TEXT,
                "fechaFirmaEmpleado" TEXT,
                ciudad TEXT,
                region TEXT,
                estado TEXT,
                empresa TEXT,
                "nombreEmpresa" TEXT,
                "centroCostoRaw" TEXT,
                sucursal TEXT NOT NULL DEFAULT 'CASA MATRIZ',
                rbd INTEGER DEFAULT 0,
                establecimiento TEXT,
                "supervisorRut" TEXT,
                "supervisorNombre" TEXT,
                "fechaInicioFirma" TEXT,
                "fechaUltimaFirma" TEXT,
                "apoderado1" TEXT,
                "nombreApoderado1" TEXT,
                "fechaFirmaApoderado1" TEXT,
                "apoderado2" TEXT,
                "nombreApoderado2" TEXT,
                "fechaFirmaApoderado2" TEXT,
                "tipoDocumento" TEXT NOT NULL,
                detalle TEXT,
                "documentoFirmado" TEXT NOT NULL DEFAULT 'No firmado',
                "numeroFirmas" TEXT,
                aprobador TEXT,
                "nombreAprobador" TEXT,
                cargo TEXT,
                "fechaEmision" TEXT,
                "usuarioEmisor" TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        // 3. Índices de aceleración para consultas analíticas
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_rrhh_firmas_empleado_hash" ON "Pers_RRHH_Firmas_Pendientes"("empleadoRutHash");`)
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_rrhh_firmas_sucursal" ON "Pers_RRHH_Firmas_Pendientes"(sucursal);`)
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_rrhh_firmas_rbd" ON "Pers_RRHH_Firmas_Pendientes"(rbd);`)
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_rrhh_firmas_supervisor" ON "Pers_RRHH_Firmas_Pendientes"("supervisorNombre");`)
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_rrhh_firmas_tipo_doc" ON "Pers_RRHH_Firmas_Pendientes"("tipoDocumento");`)
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "idx_rrhh_firmas_dias" ON "Pers_RRHH_Firmas_Pendientes"("diasAtraso");`)

        initialized = true
    } catch (error) {
        console.error('Error al inicializar tablas Pers_RRHH_Firmas:', error)
    }
}

