import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

let hasInitialized = false
let isInitializing = false

/**
 * Auto-recuperación (self-healing) idempotente para todas las tablas del módulo de Logística.
 * Cumple con la directriz del proyecto de no requerir migraciones destructivas en producción
 * y asegurar que las tablas existan siempre físicamente en PostgreSQL.
 */
export async function ensureLogisticaTables(): Promise<void> {
    if (hasInitialized) return
    if (isInitializing) return

    isInitializing = true
    try {
        // 1. log_bodegas
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "log_bodegas" (
                id TEXT PRIMARY KEY,
                codigo TEXT NOT NULL UNIQUE,
                nombre TEXT NOT NULL,
                "sucursalId" TEXT,
                direccion TEXT,
                activa BOOLEAN NOT NULL DEFAULT TRUE,
                orden INTEGER NOT NULL DEFAULT 0,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)
        await prisma.$executeRawUnsafe(`ALTER TABLE "log_bodegas" ADD COLUMN IF NOT EXISTS "sucursalId" TEXT;`).catch(() => {})

        // 2. log_usuario_bodegas
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "log_usuario_bodegas" (
                id TEXT PRIMARY KEY,
                "usuarioId" TEXT NOT NULL,
                "bodegaId" TEXT NOT NULL REFERENCES "log_bodegas"(id) ON DELETE CASCADE,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "log_usuario_bodegas_usuarioId_bodegaId_key" UNIQUE ("usuarioId", "bodegaId")
            );
        `).catch(() => {})

        // 3. log_andenes
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "log_andenes" (
                id TEXT PRIMARY KEY,
                "bodegaId" TEXT NOT NULL REFERENCES "log_bodegas"(id) ON DELETE CASCADE,
                codigo TEXT NOT NULL,
                nombre TEXT NOT NULL,
                "tipoCarga" TEXT NOT NULL DEFAULT 'GENERAL',
                "estadoOperativo" TEXT NOT NULL DEFAULT 'DISPONIBLE',
                orden INTEGER NOT NULL DEFAULT 0,
                activo BOOLEAN NOT NULL DEFAULT TRUE,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "log_andenes_bodegaId_codigo_key" UNIQUE ("bodegaId", codigo)
            );
        `)
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "log_andenes_bodegaId_idx" ON "log_andenes"("bodegaId");`).catch(() => {})
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "log_andenes_estadoOperativo_idx" ON "log_andenes"("estadoOperativo");`).catch(() => {})

        // 4. log_transportistas
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "log_transportistas" (
                id TEXT PRIMARY KEY,
                rut TEXT NOT NULL UNIQUE,
                "razonSocial" TEXT NOT NULL,
                contacto TEXT,
                telefono TEXT,
                email TEXT,
                activo BOOLEAN NOT NULL DEFAULT TRUE,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        // 5. log_choferes
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "log_choferes" (
                id TEXT PRIMARY KEY,
                rut TEXT NOT NULL UNIQUE,
                nombre TEXT NOT NULL,
                telefono TEXT NOT NULL,
                email TEXT,
                "telegramChatId" TEXT,
                "transportistaId" TEXT REFERENCES "log_transportistas"(id) ON DELETE SET NULL,
                activo BOOLEAN NOT NULL DEFAULT TRUE,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "log_choferes_telefono_idx" ON "log_choferes"(telefono);`).catch(() => {})
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "log_choferes_telegramChatId_idx" ON "log_choferes"("telegramChatId");`).catch(() => {})

        // 6. log_camiones
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "log_camiones" (
                id TEXT PRIMARY KEY,
                patente TEXT NOT NULL UNIQUE,
                "tipoVehiculo" TEXT NOT NULL DEFAULT 'RAMPLA',
                "capacidadKg" NUMERIC(10,2),
                "capacidadM3" NUMERIC(10,2),
                "transportistaId" TEXT REFERENCES "log_transportistas"(id) ON DELETE SET NULL,
                activo BOOLEAN NOT NULL DEFAULT TRUE,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        // 7. log_clientes
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "log_clientes" (
                id TEXT PRIMARY KEY,
                codigo TEXT NOT NULL UNIQUE,
                "razonSocial" TEXT NOT NULL,
                direccion TEXT,
                comuna TEXT,
                region TEXT,
                activo BOOLEAN NOT NULL DEFAULT TRUE,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        // 8. log_rutas
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "log_rutas" (
                id TEXT PRIMARY KEY,
                "numeroRuta" TEXT NOT NULL UNIQUE,
                "bodegaId" TEXT NOT NULL REFERENCES "log_bodegas"(id),
                "transportistaId" TEXT REFERENCES "log_transportistas"(id),
                "choferId" TEXT NOT NULL REFERENCES "log_choferes"(id),
                "camionId" TEXT NOT NULL REFERENCES "log_camiones"(id),
                "clienteId" TEXT REFERENCES "log_clientes"(id),
                estado TEXT NOT NULL DEFAULT 'PROGRAMADA',
                "andenId" TEXT REFERENCES "log_andenes"(id),
                "fechaRuta" TEXT NOT NULL,
                "horaProgramada" TEXT NOT NULL,
                "horaLlegadaPorton" TIMESTAMP(3),
                "horaEntradaAnden" TIMESTAMP(3),
                "horaSalidaAnden" TIMESTAMP(3),
                "selloSalida" TEXT,
                "totalBultos" INTEGER DEFAULT 0,
                "totalKilos" NUMERIC(10,2),
                observaciones TEXT,
                "telegramMessageId" TEXT,
                "tokenRuta" TEXT NOT NULL UNIQUE,
                "creadaPorId" TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "log_rutas_bodegaId_idx" ON "log_rutas"("bodegaId");`).catch(() => {})
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "log_rutas_fechaRuta_idx" ON "log_rutas"("fechaRuta");`).catch(() => {})
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "log_rutas_estado_idx" ON "log_rutas"(estado);`).catch(() => {})
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "log_rutas_andenId_idx" ON "log_rutas"("andenId");`).catch(() => {})
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "log_rutas_choferId_idx" ON "log_rutas"("choferId");`).catch(() => {})
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "log_rutas_tokenRuta_idx" ON "log_rutas"("tokenRuta");`).catch(() => {})

        // 9. log_eventos_ruta
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "log_eventos_ruta" (
                id TEXT PRIMARY KEY,
                "rutaId" TEXT NOT NULL REFERENCES "log_rutas"(id) ON DELETE CASCADE,
                "estadoAnterior" TEXT,
                "estadoNuevo" TEXT NOT NULL,
                "andenId" TEXT REFERENCES "log_andenes"(id),
                "origenCambio" TEXT NOT NULL DEFAULT 'SISTEMA',
                notas TEXT,
                "metadataJson" TEXT,
                "usuarioId" TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "log_eventos_ruta_rutaId_idx" ON "log_eventos_ruta"("rutaId");`).catch(() => {})
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "log_eventos_ruta_createdAt_idx" ON "log_eventos_ruta"("createdAt");`).catch(() => {})

        // 10. log_integracion_configs
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "log_integracion_configs" (
                id TEXT PRIMARY KEY,
                nombre TEXT NOT NULL DEFAULT 'N8N Despacho & Telegram',
                provider TEXT NOT NULL DEFAULT 'N8N',
                "webhookUrl" TEXT NOT NULL,
                "secretToken" TEXT,
                activo BOOLEAN NOT NULL DEFAULT TRUE,
                "eventosSuscritos" TEXT NOT NULL DEFAULT '["RUTA_CREADA","CHOFER_NOTIFICADO","ANDEN_ASIGNADO","DESPACHO_COMPLETO"]',
                "headersJson" TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        // 11. log_integracion_logs
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "log_integracion_logs" (
                id TEXT PRIMARY KEY,
                "integracionConfigId" TEXT REFERENCES "log_integracion_configs"(id) ON DELETE SET NULL,
                evento TEXT NOT NULL,
                "rutaId" TEXT REFERENCES "log_rutas"(id) ON DELETE CASCADE,
                "payloadEnviado" TEXT,
                "respuestaCodigo" INTEGER,
                "respuestaCuerpo" TEXT,
                estado TEXT NOT NULL DEFAULT 'PENDIENTE',
                intentos INTEGER NOT NULL DEFAULT 1,
                "errorDetalle" TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "log_integracion_logs_evento_idx" ON "log_integracion_logs"(evento);`).catch(() => {})
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "log_integracion_logs_estado_idx" ON "log_integracion_logs"(estado);`).catch(() => {})

        // 12. log_parametros
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "log_parametros" (
                id TEXT PRIMARY KEY,
                "bodegaId" TEXT REFERENCES "log_bodegas"(id) ON DELETE CASCADE,
                clave TEXT NOT NULL UNIQUE,
                valor TEXT NOT NULL,
                descripcion TEXT,
                tipo TEXT NOT NULL DEFAULT 'NUMERO',
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        // 13. Sincronización transparente con sucursales del sistema
        const sucursales = await prisma.sucursal.findMany({ orderBy: { nombre: 'asc' } }).catch(() => [])
        for (let i = 0; i < sucursales.length; i++) {
            const suc = sucursales[i]
            const cleanCode = suc.nombre
                .trim()
                .toUpperCase()
                .replace(/\s+/g, '-')

            const existing = await prisma.logBodega.findFirst({
                where: {
                    OR: [
                        { sucursalId: suc.id },
                        { codigo: cleanCode },
                        { nombre: suc.nombre }
                    ]
                }
            }).catch(() => null)

            let bodegaId = existing?.id

            if (!existing) {
                bodegaId = crypto.randomUUID()
                await prisma.logBodega.create({
                    data: {
                        id: bodegaId,
                        codigo: cleanCode,
                        nombre: suc.nombre,
                        sucursalId: suc.id,
                        direccion: suc.direccion || null,
                        activa: true,
                        orden: i + 1
                    }
                }).catch(() => {})
            } else {
                await prisma.logBodega.update({
                    where: { id: existing.id },
                    data: {
                        sucursalId: suc.id,
                        nombre: suc.nombre,
                        direccion: suc.direccion || existing.direccion,
                        activa: true,
                        orden: i + 1
                    }
                }).catch(() => {})
            }

            // Si la bodega no tiene andenes, sembramos 2 andenes por defecto
            if (bodegaId) {
                const countAndenes = await prisma.logAnden.count({ where: { bodegaId } }).catch(() => 0)
                if (countAndenes === 0) {
                    await prisma.logAnden.createMany({
                        data: [
                            {
                                id: crypto.randomUUID(),
                                bodegaId,
                                codigo: 'AND-01',
                                nombre: 'Andén 01 - Carga General',
                                tipoCarga: 'GENERAL',
                                estadoOperativo: 'DISPONIBLE',
                                orden: 1,
                                activo: true
                            },
                            {
                                id: crypto.randomUUID(),
                                bodegaId,
                                codigo: 'AND-02',
                                nombre: 'Andén 02 - Carga General',
                                tipoCarga: 'GENERAL',
                                estadoOperativo: 'DISPONIBLE',
                                orden: 2,
                                activo: true
                            }
                        ]
                    }).catch(() => {})
                }
            }
        }

        // Sembrar parámetros por defecto si no existen
        const paramCount = await prisma.logParametro.count().catch(() => 0)
        if (paramCount === 0) {
            const params = [
                { clave: 'TIEMPO_ALERTA_ANDEN_MINUTOS', valor: '45', desc: 'Minutos de permanencia máxima antes de alertar demora en andén', tipo: 'NUMERO' },
                { clave: 'TIEMPO_TOLERANCIA_PORTON_MINUTOS', valor: '30', desc: 'Tolerancia en minutos de espera en portón antes de reasignación', tipo: 'NUMERO' },
                { clave: 'AUTO_NOTIFICAR_TELEGRAM', valor: 'true', desc: 'Notificar automáticamente al chofer vía Telegram al asignar andén', tipo: 'BOOLEANO' },
            ]
            for (const p of params) {
                await prisma.logParametro.upsert({
                    where: { clave: p.clave },
                    update: {},
                    create: {
                        id: crypto.randomUUID(),
                        clave: p.clave,
                        valor: p.valor,
                        descripcion: p.desc,
                        tipo: p.tipo
                    }
                }).catch(() => {})
            }
        }

        hasInitialized = true
    } catch (err) {
        console.error('[ensureLogisticaTables] Error en self-healing de Logística:', err)
    } finally {
        isInitializing = false
    }
}
