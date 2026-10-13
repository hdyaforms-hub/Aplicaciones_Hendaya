const { PrismaClient } = require('../src/generated/client');
const prisma = new PrismaClient();

async function init() {
    try {
        console.log('Creando tablas Pers_Hextra_ en la base de datos...');

        // 1. Tabla de Control de Cargas
        await prisma.$executeRawUnsafe(`
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
        `);

        // 2. Tabla Principal de Horas Extras
        await prisma.$executeRawUnsafe(`
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
        `);

        // 3. Índice Único para upsert estricto: evita cargas n veces y actualiza registros por (identificadorHash, fecha)
        await prisma.$executeRawUnsafe(`
            CREATE UNIQUE INDEX IF NOT EXISTS "pers_hextra_reg_id_fecha_unique" 
            ON "Pers_Hextra_Registro"("identificadorHash", fecha);
        `);

        // 4. Índices de aceleración de consultas
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_hextra_reg_id_hash_idx" ON "Pers_Hextra_Registro"("identificadorHash");`);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_hextra_reg_fecha_idx" ON "Pers_Hextra_Registro"(fecha);`);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_hextra_reg_rbd_idx" ON "Pers_Hextra_Registro"(rbd);`);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_hextra_reg_sucursal_idx" ON "Pers_Hextra_Registro"(sucursal);`);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_hextra_reg_supervisor_idx" ON "Pers_Hextra_Registro"(supervisor);`);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "pers_hextra_reg_carga_idx" ON "Pers_Hextra_Registro"("cargaId");`);

        // 5. Asignar permiso a roles admin
        const adminRoles = await prisma.role.findMany({
            where: {
                OR: [
                    { name: { contains: 'admin', mode: 'insensitive' } },
                    { name: { contains: 'gerencia', mode: 'insensitive' } }
                ]
            }
        });

        for (const r of adminRoles) {
            let currentPerms = [];
            try {
                currentPerms = typeof r.permissions === 'string' ? JSON.parse(r.permissions) : (r.permissions || []);
            } catch (e) {
                currentPerms = [];
            }
            if (!currentPerms.includes('manage_personal_horas_extras_carga')) {
                currentPerms.push('manage_personal_horas_extras_carga');
                await prisma.role.update({
                    where: { id: r.id },
                    data: { permissions: JSON.stringify(currentPerms) }
                });
                console.log(`Permiso agregado al rol: ${r.name}`);
            }
        }

        console.log('Inicialización de Pers_Hextra_ completada con éxito.');
    } catch (e) {
        console.error('Error inicializando tablas Pers_Hextra_:', e);
    } finally {
        await prisma.$disconnect();
    }
}

init();
