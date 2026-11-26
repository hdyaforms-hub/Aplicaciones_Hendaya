import { rawPrisma } from '@/lib/prisma'

export async function ensureDiarioMuralTables() {
    try {
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "diario_mural" (
                "id" VARCHAR(64) PRIMARY KEY,
                "titulo" VARCHAR(255) NOT NULL,
                "contenido" TEXT NOT NULL,
                "categoria" VARCHAR(100) DEFAULT 'General',
                "color" VARCHAR(50) DEFAULT 'yellow',
                "duracionDias" INTEGER NOT NULL DEFAULT 30,
                "fechaExpiracion" TIMESTAMP WITH TIME ZONE NOT NULL,
                "autorId" VARCHAR(100),
                "autorNombre" VARCHAR(255) NOT NULL,
                "autorEmail" VARCHAR(255),
                "autorRol" VARCHAR(100),
                "fijado" BOOLEAN DEFAULT FALSE,
                "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `)

        // Crear índices para optimizar búsquedas y expiración
        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "idx_diario_mural_expiracion" ON "diario_mural" ("fechaExpiracion");
        `)

        // Columnas para adjuntar imagen y control de lectura de notificaciones
        await rawPrisma.$executeRawUnsafe(`
            ALTER TABLE "diario_mural" ADD COLUMN IF NOT EXISTS "imagenUrl" TEXT;
        `)
        await rawPrisma.$executeRawUnsafe(`
            ALTER TABLE "diario_mural" ADD COLUMN IF NOT EXISTS "leidoPor" TEXT DEFAULT '[]';
        `)
        // Columnas para alcance (Sucursal / Global)
        await rawPrisma.$executeRawUnsafe(`
            ALTER TABLE "diario_mural" ADD COLUMN IF NOT EXISTS "alcance" VARCHAR(50) DEFAULT 'GLOBAL';
        `)
        await rawPrisma.$executeRawUnsafe(`
            ALTER TABLE "diario_mural" ADD COLUMN IF NOT EXISTS "sucursalId" VARCHAR(100);
        `)
        await rawPrisma.$executeRawUnsafe(`
            ALTER TABLE "diario_mural" ADD COLUMN IF NOT EXISTS "sucursalNombre" VARCHAR(255) DEFAULT 'Global';
        `)
        await rawPrisma.$executeRawUnsafe(`
            ALTER TABLE "diario_mural" ADD COLUMN IF NOT EXISTS "sucursalesDestino" TEXT DEFAULT '[]';
        `)
        // Columna para reacciones positivas de usuarios (emojis)
        await rawPrisma.$executeRawUnsafe(`
            ALTER TABLE "diario_mural" ADD COLUMN IF NOT EXISTS "reacciones" TEXT DEFAULT '{}';
        `)

        // Sembrar avisos iniciales si la tabla está vacía
        const countRows = await rawPrisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int as count FROM "diario_mural";`)
        const count = countRows[0]?.count || 0

        if (count === 0) {
            const hoy = new Date()
            const expira30 = new Date(hoy.getTime() + 30 * 24 * 60 * 60 * 1000)
            const expira20 = new Date(hoy.getTime() + 20 * 24 * 60 * 60 * 1000)
            const expira10 = new Date(hoy.getTime() + 10 * 24 * 60 * 60 * 1000)

            const seeds = [
                {
                    id: 'seed-dm-1',
                    titulo: 'BIENVENIDOS AL DIARIO MURAL',
                    contenido: 'Este es el nuevo espacio de comunicación y novedades para el equipo de Hendaya. Aquí podrás enterarte de noticias, avisos y anuncios importantes.',
                    categoria: 'Institucional',
                    color: 'yellow',
                    duracionDias: 30,
                    fechaExpiracion: expira30,
                    autorNombre: 'Administración Hendaya',
                    autorRol: 'Administrador'
                },
                {
                    id: 'seed-dm-2',
                    titulo: 'RECORDATORIO DE SEGURIDAD',
                    contenido: 'Reiteramos la importancia del uso correcto de EPP y cumplimiento estricto de las normas de higiene y manipulación en cada uno de los recintos.',
                    categoria: 'Seguridad',
                    color: 'blue',
                    duracionDias: 20,
                    fechaExpiracion: expira20,
                    autorNombre: 'Prevención de Riesgos',
                    autorRol: 'Supervisor'
                },
                {
                    id: 'seed-dm-3',
                    titulo: 'SOPORTE Y CONSULTAS TI',
                    contenido: 'Recuerda que para asistencia técnica o requerimientos sobre la plataforma web puedes escribir a soporte a través de la opción de Anexos o Mesa de Ayuda.',
                    categoria: 'Tecnología',
                    color: 'green',
                    duracionDias: 10,
                    fechaExpiracion: expira10,
                    autorNombre: 'Área de Informática',
                    autorRol: 'Administrador'
                }
            ]

            for (const s of seeds) {
                await rawPrisma.$executeRawUnsafe(`
                    INSERT INTO "diario_mural" (
                        "id", "titulo", "contenido", "categoria", "color",
                        "duracionDias", "fechaExpiracion", "autorNombre", "autorRol", "createdAt", "updatedAt"
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    ON CONFLICT ("id") DO NOTHING;
                `, s.id, s.titulo, s.contenido, s.categoria, s.color, s.duracionDias, s.fechaExpiracion, s.autorNombre, s.autorRol)
            }
        }
    } catch (error) {
        console.error('[ensureDiarioMuralTables] Error inicializando tabla diario_mural:', error)
    }
}
