import { rawPrisma } from '@/lib/prisma'

let isInitialized = false

/**
 * Inicializador idempotente y auto-recuperable de las tablas de Soluciones y Planes de Acción (C9):
 * - Multas_Diccionario_Solucion
 * - Multas_Plan_Accion
 * - Multas_Plan_Accion_Item
 *
 * Incluye semillas de soluciones estandarizadas basadas en el Anexo 3 de la IT JUNAEB.
 */
export async function ensureSolucionesPlanTables(): Promise<void> {
    if (isInitialized) return

    try {
        // 1. Diccionario de Soluciones
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Multas_Diccionario_Solucion" (
                "id" TEXT PRIMARY KEY,
                "aspecto" VARCHAR(10) NOT NULL,
                "tipoNC" VARCHAR(120) NOT NULL,
                "accionCorrectivaTipo" TEXT NOT NULL,
                "plazoDiasEstandar" INTEGER NOT NULL DEFAULT 3,
                "evidenciaRequerida" TEXT NOT NULL,
                "activo" BOOLEAN NOT NULL DEFAULT true,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "multas_dicc_sol_aspecto_idx"
            ON "Multas_Diccionario_Solucion" ("aspecto");
        `)

        // 2. Planes de Acción por Acta
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Multas_Plan_Accion" (
                "id" TEXT PRIMARY KEY,
                "folio" VARCHAR(50) NOT NULL UNIQUE,
                "rbd" INTEGER,
                "licitacionId" INTEGER,
                "licitacionNombre" VARCHAR(150),
                "sucursal" VARCHAR(100),
                "estado" VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
                "prioridad" VARCHAR(20) NOT NULL DEFAULT 'MEDIA',
                "fechaCompromiso" TIMESTAMP(3),
                "responsableAsignado" VARCHAR(120),
                "cerradoPor" VARCHAR(100),
                "fechaCierre" TIMESTAMP(3),
                "observacionesCierre" TEXT,
                "totalItems" INTEGER NOT NULL DEFAULT 0,
                "itemsResueltos" INTEGER NOT NULL DEFAULT 0,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "multas_plan_acc_rbd_idx"
            ON "Multas_Plan_Accion" ("rbd");
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "multas_plan_acc_sucursal_idx"
            ON "Multas_Plan_Accion" ("sucursal");
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "multas_plan_acc_estado_idx"
            ON "Multas_Plan_Accion" ("estado");
        `)

        // 3. Ítems del Plan de Acción
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Multas_Plan_Accion_Item" (
                "id" TEXT PRIMARY KEY,
                "planId" TEXT NOT NULL REFERENCES "Multas_Plan_Accion"("id") ON DELETE CASCADE,
                "aspecto" VARCHAR(10) NOT NULL,
                "hallazgoDetectado" TEXT NOT NULL,
                "accionTomada" TEXT,
                "evidenciaUrl" TEXT,
                "evidenciaNombre" VARCHAR(255),
                "estadoItem" VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
                "fechaEjecucion" TIMESTAMP(3),
                "ejecutadoPor" VARCHAR(100),
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "multas_plan_item_plan_idx"
            ON "Multas_Plan_Accion_Item" ("planId");
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "multas_plan_item_aspecto_idx"
            ON "Multas_Plan_Accion_Item" ("aspecto");
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "multas_plan_item_estado_idx"
            ON "Multas_Plan_Accion_Item" ("estadoItem");
        `)

        // Semillas del Diccionario de Soluciones si está vacío
        const countDicc = await rawPrisma.$queryRawUnsafe<any[]>(`
            SELECT COUNT(*)::int as count FROM "Multas_Diccionario_Solucion";
        `).catch(() => [{ count: 1 }])

        if (Number(countDicc[0]?.count || 0) === 0) {
            await rawPrisma.$executeRawUnsafe(`
                INSERT INTO "Multas_Diccionario_Solucion" 
                ("id", "aspecto", "tipoNC", "accionCorrectivaTipo", "plazoDiasEstandar", "evidenciaRequerida", "activo")
                VALUES 
                (
                    gen_random_uuid()::text,
                    'G',
                    'Gramaje deficitario en preparación principal',
                    'Capacitación en terreno sobre tabla de porcionamiento y uso obligatorio de cucharones dosificadores estandarizados según minuta oficial.',
                    2,
                    'Fotografía de tabla de porcionamiento en muro, acta de inducción firmada por manipuladoras y registro de pesaje interno de verificación.',
                    true
                ),
                (
                    gen_random_uuid()::text,
                    'J',
                    'Balanza de cocina descalibrada o ausente',
                    'Envío inmediato de balanza digital de reemplazo con sello de calibración vigente y retiro de balanza defectuosa.',
                    1,
                    'Guía de despacho de recepción en casino, foto de la balanza en funcionamiento con patrón de masa conocido.',
                    true
                ),
                (
                    gen_random_uuid()::text,
                    'K',
                    'Temperatura de servicio fuera de rango normativo',
                    'Ajuste y revisión de equipos mantenedores de calor/baño maría, verificación de tiempos de espera entre cocción y distribución a los estudiantes.',
                    2,
                    'Planilla de registro de temperatura horaria firmada por supervisora, informe técnico de mantenedor térmico.',
                    true
                ),
                (
                    gen_random_uuid()::text,
                    'B',
                    'Dotación incompleta de manipuladoras',
                    'Activación inmediata de manipuladora volante o reemplazo desde bolsa de trabajo zonal para cubrir el turno.',
                    1,
                    'Libro de asistencia o reporte biométrico con firma de la manipuladora volante de reemplazo.',
                    true
                ),
                (
                    gen_random_uuid()::text,
                    'A',
                    'Aseo e higiene deficiente en superficies o bodega',
                    'Sanitización profunda de campanas, pisos y mesones de acero inoxidable con desinfectante clorado de amplio espectro.',
                    1,
                    'Fotografía antes y después del área sanitizada, lista de chequeo de limpieza diaria firmada.',
                    true
                ),
                (
                    gen_random_uuid()::text,
                    'F',
                    'Materia prima con no conformidad de frescura o calibre',
                    'Rechazo de lote al proveedor distribuidor y reposición de emergencia con producto de primera calidad desde bodega central.',
                    1,
                    'Guía de devolución de producto defectuoso y guía de recepción del nuevo lote conforme.',
                    true
                ),
                (
                    gen_random_uuid()::text,
                    'L',
                    'Falta de contramuestra del servicio del día',
                    'Instrucción inmediata y reinducción sobre procedimiento estandarizado de toma y rotulación de contramuestras por 72 horas en frío.',
                    1,
                    'Fotografía del frasco rotulado de contramuestra dentro del refrigerador con fecha y servicio.',
                    true
                );
            `)
        }

        isInitialized = true
    } catch (error) {
        console.error('Error al inicializar tablas de soluciones y planes de acción:', error)
    }
}
