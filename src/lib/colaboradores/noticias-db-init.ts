import { rawPrisma } from '@/lib/prisma'

let initialized = false

const NOTICIAS_DEFAULT = [
    {
        titulo: '¿Adiós Junaeb?: El desconocido oficio del Ministerio de Hacienda que recomienda descontinuar el Programa de Alimentación Escolar',
        fuente: 'ContrapoderChile.cl',
        link: 'https://contrapoderchile.cl',
        orden: 1
    },
    {
        titulo: 'El hambre también entra a la sala de clases',
        fuente: 'radio.uchile.cl',
        link: 'https://radio.uchile.cl',
        orden: 2
    },
    {
        titulo: 'Colegios alertan que Junaeb redujo sus raciones de alimentos y organismo lo atribuye a mecanismo habitual de ajuste',
        fuente: 'La Tercera',
        link: 'https://www.latercera.com',
        orden: 3
    },
    {
        titulo: 'Junaeb confirma nuevas asignaciones de Beca de Alimentación para 2027 y desmiente versión de redes sociales',
        fuente: 'Diario Concepción',
        link: 'https://www.diarioconcepcion.cl',
        orden: 4
    },
    {
        titulo: '55 trabajadoras del Programa de Alimentación Escolar certifican sus competencias laborales en Santiago',
        fuente: 'mintrab.gob.cl',
        link: 'https://www.mintrab.gob.cl',
        orden: 5
    },
    {
        titulo: 'Allanan oficinas del Congreso y Junaeb por presuntas irregularidades en licitación del Programa de Alimentación Escolar',
        fuente: 'Chilevisión',
        link: 'https://www.chilevision.cl',
        orden: 6
    }
]

const FUENTES_RSS_DEFAULT = [
    {
        nombre: 'Google News - Alimentación Escolar y JUNAEB Chile',
        urlFeed: 'https://news.google.com/rss/search?q=JUNAEB+alimentacion+escolar+Chile&hl=es-419&gl=CL&ceid=CL:es-419',
        activo: true
    },
    {
        nombre: 'Google News - Manipuladoras y Programas de Alimentación',
        urlFeed: 'https://news.google.com/rss/search?q=manipuladoras+alimentos+JUNAEB+Chile&hl=es-419&gl=CL&ceid=CL:es-419',
        activo: true
    }
]

export async function ensureNoticiasTables(): Promise<void> {
    if (initialized) return

    try {
        // 1. Tabla principal de noticias
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "noticias_alimentacion" (
                "id" TEXT PRIMARY KEY,
                "titulo" TEXT NOT NULL,
                "fuente" TEXT NOT NULL,
                "link" TEXT NOT NULL,
                "orden" INTEGER NOT NULL DEFAULT 1,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        // Columnas idempotentes adicionales
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "noticias_alimentacion" ADD COLUMN IF NOT EXISTS "activo" BOOLEAN NOT NULL DEFAULT TRUE;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "noticias_alimentacion" ADD COLUMN IF NOT EXISTS "esAutomatica" BOOLEAN NOT NULL DEFAULT FALSE;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "noticias_alimentacion" ADD COLUMN IF NOT EXISTS "resumen" TEXT;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "noticias_alimentacion" ADD COLUMN IF NOT EXISTS "fechaPublicacion" TIMESTAMP(3);`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "noticias_alimentacion" ADD COLUMN IF NOT EXISTS "creadoPor" VARCHAR(100);`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "noticias_alimentacion" ADD COLUMN IF NOT EXISTS "actualizadoPor" VARCHAR(100);`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "noticias_alimentacion" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;`)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "idx_noticias_alimentacion_orden_activo"
            ON "noticias_alimentacion" ("orden", "activo");
        `)

        // 2. Tabla de fuentes RSS y configuración de sincronización
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "noticias_fuentes_config" (
                "id" TEXT PRIMARY KEY,
                "nombre" VARCHAR(150) NOT NULL,
                "urlFeed" TEXT NOT NULL,
                "activo" BOOLEAN NOT NULL DEFAULT TRUE,
                "ultimaSincronizacion" TIMESTAMP(3),
                "totalImportadas" INTEGER DEFAULT 0,
                "creadoPor" VARCHAR(100),
                "actualizadoPor" VARCHAR(100),
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        // Sembrado inicial de noticias si la tabla está vacía
        const countRes = await rawPrisma.$queryRawUnsafe<{ count: string | number }[]>(
            `SELECT COUNT(*)::text as count FROM "noticias_alimentacion";`
        )
        const totalNoticias = Number(countRes[0]?.count || 0)

        if (totalNoticias === 0) {
            for (const n of NOTICIAS_DEFAULT) {
                const id = crypto.randomUUID()
                await rawPrisma.$executeRawUnsafe(`
                    INSERT INTO "noticias_alimentacion" (
                        "id", "titulo", "fuente", "link", "orden", "activo", "esAutomatica", "creadoPor", "createdAt"
                    ) VALUES ($1, $2, $3, $4, $5, TRUE, FALSE, 'SISTEMA', CURRENT_TIMESTAMP)
                    ON CONFLICT ("id") DO NOTHING;
                `, id, n.titulo, n.fuente, n.link, n.orden)
            }
        }

        // Sembrado inicial de fuentes RSS si la tabla está vacía
        const countFuentes = await rawPrisma.$queryRawUnsafe<{ count: string | number }[]>(
            `SELECT COUNT(*)::text as count FROM "noticias_fuentes_config";`
        )
        const totalFuentes = Number(countFuentes[0]?.count || 0)

        if (totalFuentes === 0) {
            for (const f of FUENTES_RSS_DEFAULT) {
                const id = crypto.randomUUID()
                await rawPrisma.$executeRawUnsafe(`
                    INSERT INTO "noticias_fuentes_config" (
                        "id", "nombre", "urlFeed", "activo", "creadoPor", "createdAt"
                    ) VALUES ($1, $2, $3, $4, 'SISTEMA', CURRENT_TIMESTAMP)
                    ON CONFLICT ("id") DO NOTHING;
                `, id, f.nombre, f.urlFeed, f.activo)
            }
        }

        initialized = true
    } catch (error) {
        console.error('[ensureNoticiasTables] Error inicializando tablas de noticias:', error)
    }
}
