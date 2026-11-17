import { rawPrisma } from '@/lib/prisma'

let isInitialized = false

/**
 * Inicializador idempotente y auto-recuperable de la tabla Biblioteca de Argumentos (C8):
 * - Multas_Argumento_Biblioteca
 *
 * Incluye semillas de plantillas jurídicas y técnicas estandarizadas oficiales.
 */
export async function ensureBibliotecaArgumentosTables(): Promise<void> {
    if (isInitialized) return

    try {
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Multas_Argumento_Biblioteca" (
                "id" TEXT PRIMARY KEY,
                "aspecto" VARCHAR(10) NOT NULL,
                "reglaId" VARCHAR(50),
                "titulo" VARCHAR(200) NOT NULL,
                "argumentoTexto" TEXT NOT NULL,
                "fundamentoLegal" TEXT,
                "folioEjemplo" VARCHAR(50),
                "numeroRexPrecedente" VARCHAR(100),
                "resultadoHistorico" VARCHAR(30) NOT NULL DEFAULT 'ACEPTADO',
                "montoRebajadoUtm" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                "vecesUtilizado" INTEGER NOT NULL DEFAULT 0,
                "etiquetas" TEXT,
                "esPlantillaOficial" BOOLEAN NOT NULL DEFAULT false,
                "autor" VARCHAR(100) NOT NULL,
                "activo" BOOLEAN NOT NULL DEFAULT true,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "multas_arg_bib_aspecto_res_idx"
            ON "Multas_Argumento_Biblioteca" ("aspecto", "resultadoHistorico");
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "multas_arg_bib_regla_idx"
            ON "Multas_Argumento_Biblioteca" ("reglaId");
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "multas_arg_bib_plantilla_idx"
            ON "Multas_Argumento_Biblioteca" ("esPlantillaOficial");
        `)

        // Semillas de plantillas jurídicas oficiales iniciales (si la tabla está vacía)
        const countRows = await rawPrisma.$queryRawUnsafe<any[]>(`
            SELECT COUNT(*)::int as count FROM "Multas_Argumento_Biblioteca";
        `).catch(() => [{ count: 1 }])

        if (Number(countRows[0]?.count || 0) === 0) {
            await rawPrisma.$executeRawUnsafe(`
                INSERT INTO "Multas_Argumento_Biblioteca" 
                ("id", "aspecto", "reglaId", "titulo", "argumentoTexto", "fundamentoLegal", "resultadoHistorico", "montoRebajadoUtm", "etiquetas", "esPlantillaOficial", "autor")
                VALUES 
                (
                    gen_random_uuid()::text,
                    'G',
                    'G-MUESTRA-1',
                    'Muestra de pesaje insuficiente según tabla AQL',
                    'Se impugna la sanción impuesta en el aspecto G por cuanto el supervisor de JUNAEB evaluó un número de bandejas inferior al tamaño muestral exigido por la tabla AQL para el universo de raciones programadas en el establecimiento. De conformidad con la Instrucción de Trabajo de Elementos Esenciales, la evaluación de gramaje carece de representatividad estadística si no se cumple el muestreo mínimo normativo.',
                    'Instrucción de Trabajo de Elementos Esenciales JUNAEB, Anexo 3 NCh 44.',
                    'PLANTILLA_OFICIAL',
                    15.5,
                    'pesaje, aql, muestra insuficiente, bandejas, gramaje',
                    true,
                    'Área Legal Hendaya'
                ),
                (
                    gen_random_uuid()::text,
                    'G',
                    'G-J-1',
                    'Imputación de gramaje sin balanza calibrada en aspecto J',
                    'No resulta jurídicamente procedente imputar incumplimiento en gramaje de preparaciones (Aspecto G) cuando en la misma acta se constató la inexistencia o descalibración del instrumento de pesaje (Aspecto J). La falta de instrumento idóneo invalida cualquier medición cuantitativa realizada en terreno.',
                    'Bases de Licitación PAE, Criterio de Medios de Verificación Idóneos.',
                    'PLANTILLA_OFICIAL',
                    12.0,
                    'balanza, gramaje, instrumento, calibracion',
                    true,
                    'Área Legal Hendaya'
                ),
                (
                    gen_random_uuid()::text,
                    'K',
                    'K-J-1',
                    'Medición de temperatura sin termómetro certificado en aspecto J',
                    'Se rechaza la infracción en control de temperaturas (Aspecto K) al haberse consignado en el aspecto J la ausencia o falla del termómetro oficial. Sin instrumento de medición verificado, las temperaturas registradas constituyen meras apreciaciones subjetivas sin validez sancionatoria.',
                    'Manual de Supervisión PAE, Requisitos de Instrumentos de Medición.',
                    'PLANTILLA_OFICIAL',
                    10.0,
                    'temperatura, termometro, instrumento',
                    true,
                    'Área Legal Hendaya'
                ),
                (
                    gen_random_uuid()::text,
                    'H',
                    'H-1',
                    'Dotación ajustada a ratio legal 1:70 según raciones reales',
                    'La dotación de manipuladoras presentes al momento de la visita cumplía estrictamente con el ratio normativo de 1 manipuladora por cada 70 raciones efectivamente asignadas y preparadas. El supervisor calculó erróneamente el requerimiento sobre la matrícula teórica y no sobre el PMPA vigente.',
                    'Bases Técnicas PAE, Ratio de Manipuladoras 1:70.',
                    'PLANTILLA_OFICIAL',
                    8.5,
                    'manipuladoras, dotacion, ratio, 1:70',
                    true,
                    'Área Legal Hendaya'
                ),
                (
                    gen_random_uuid()::text,
                    'F',
                    'F-1',
                    'Tolerancia de porcentaje en frutas y verduras de calibre menor',
                    'El supervisor imputó no conformidad global sin considerar el rango de tolerancia reglamentario establecido en las bases para productos hortofrutícolas perecibles, donde variaciones menores de calibre no constituyen falta contractual grave ni afectan el aporte nutricional.',
                    'Bases Técnicas, Estándares de Frutas y Verduras PAE.',
                    'PLANTILLA_OFICIAL',
                    6.0,
                    'frutas, verduras, calibre, tolerancia',
                    true,
                    'Área Legal Hendaya'
                );
            `)
        }

        isInitialized = true
    } catch (error) {
        console.error('Error al inicializar tabla Biblioteca de Argumentos (C8):', error)
    }
}
