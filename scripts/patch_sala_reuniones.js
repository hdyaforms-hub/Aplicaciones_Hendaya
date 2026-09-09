const { PrismaClient } = require('../src/generated/client')
const prisma = new PrismaClient()

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

async function main() {
    console.log('--- [Producción] Verificando e inicializando tablas para Sala de Reuniones ---')

    // 1. Tabla reservas_sala
    console.log('1. Creando tabla reservas_sala si no existe...')
    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "reservas_sala" (
            id TEXT PRIMARY KEY,
            solicitante TEXT NOT NULL,
            email TEXT NOT NULL,
            "userId" TEXT,
            fecha TEXT NOT NULL,
            "horaInicio" TEXT NOT NULL,
            "horaFin" TEXT NOT NULL,
            motivo TEXT NOT NULL,
            estado TEXT NOT NULL DEFAULT 'CONFIRMADA',
            "tokenCancelacion" TEXT NOT NULL UNIQUE,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `)

    console.log('2. Creando índices para reservas_sala...')
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "reservas_sala_fecha_idx" ON "reservas_sala"(fecha);`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "reservas_sala_estado_idx" ON "reservas_sala"(estado);`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "reservas_sala_token_idx" ON "reservas_sala"("tokenCancelacion");`)

    // 2. Tabla noticias_alimentacion
    console.log('3. Creando tabla noticias_alimentacion si no existe...')
    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "noticias_alimentacion" (
            id TEXT PRIMARY KEY,
            titulo TEXT NOT NULL,
            fuente TEXT NOT NULL,
            link TEXT NOT NULL,
            orden INTEGER NOT NULL DEFAULT 0,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `)

    // 3. Sembrar noticias por defecto si está vacía
    const countNoticias = await prisma.$queryRaw`SELECT count(*)::int as count FROM "noticias_alimentacion"`
    const totalNoticias = Number(countNoticias[0]?.count || 0)
    console.log(`Noticias actuales en base de datos: ${totalNoticias}`)

    if (totalNoticias === 0) {
        console.log('Insertando noticias por defecto...')
        for (const n of NOTICIAS_DEFAULT) {
            const crypto = require('crypto')
            await prisma.$executeRawUnsafe(
                `INSERT INTO "noticias_alimentacion" (id, titulo, fuente, link, orden, "createdAt") VALUES ($1, $2, $3, $4, $5, NOW())`,
                crypto.randomUUID(),
                n.titulo,
                n.fuente,
                n.link,
                n.orden
            )
        }
        console.log('Noticias insertadas exitosamente.')
    }

    // 4. Asegurar correo de admin oficial en base de datos
    console.log('4. Sincronizando correo oficial de usuario admin...')
    await prisma.user.updateMany({
        where: { username: 'admin' },
        data: { email: 'doctohdya@hendayasac.cl' }
    })
    console.log('Correo de admin sincronizado a doctohdya@hendayasac.cl')

    console.log('--- Inicialización completada con éxito ---')
}

main()
    .catch((e) => {
        console.error('Error aplicando parche de Sala de Reuniones:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
