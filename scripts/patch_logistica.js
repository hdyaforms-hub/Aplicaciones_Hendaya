const { PrismaClient } = require('../src/generated/client')
const prisma = new PrismaClient()
const crypto = require('crypto')

async function main() {
    console.log('=== [Logística] Verificando e inicializando tablas para Control de Despacho (PostgreSQL) ===')

    // 1. log_bodegas
    console.log('1. Creando tabla log_bodegas si no existe...')
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

    // 2. log_usuario_bodegas
    console.log('2. Creando tabla log_usuario_bodegas si no existe...')
    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "log_usuario_bodegas" (
            id TEXT PRIMARY KEY,
            "usuarioId" TEXT NOT NULL,
            "bodegaId" TEXT NOT NULL REFERENCES "log_bodegas"(id) ON DELETE CASCADE,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "log_usuario_bodegas_usuarioId_bodegaId_key" UNIQUE ("usuarioId", "bodegaId")
        );
    `)

    // 3. log_andenes
    console.log('3. Creando tabla log_andenes si no existe...')
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
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "log_andenes_bodegaId_idx" ON "log_andenes"("bodegaId");`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "log_andenes_estadoOperativo_idx" ON "log_andenes"("estadoOperativo");`)

    // 4. log_transportistas
    console.log('4. Creando tabla log_transportistas si no existe...')
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
    console.log('5. Creando tabla log_choferes si no existe...')
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
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "log_choferes_telefono_idx" ON "log_choferes"(telefono);`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "log_choferes_telegramChatId_idx" ON "log_choferes"("telegramChatId");`)

    // 6. log_camiones
    console.log('6. Creando tabla log_camiones si no existe...')
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
    console.log('7. Creando tabla log_clientes si no existe...')
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
    console.log('8. Creando tabla log_rutas si no existe...')
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
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "log_rutas_bodegaId_idx" ON "log_rutas"("bodegaId");`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "log_rutas_fechaRuta_idx" ON "log_rutas"("fechaRuta");`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "log_rutas_estado_idx" ON "log_rutas"(estado);`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "log_rutas_andenId_idx" ON "log_rutas"("andenId");`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "log_rutas_choferId_idx" ON "log_rutas"("choferId");`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "log_rutas_tokenRuta_idx" ON "log_rutas"("tokenRuta");`)

    // 9. log_eventos_ruta
    console.log('9. Creando tabla log_eventos_ruta si no existe...')
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
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "log_eventos_ruta_rutaId_idx" ON "log_eventos_ruta"("rutaId");`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "log_eventos_ruta_createdAt_idx" ON "log_eventos_ruta"("createdAt");`)

    // 10. log_integracion_configs
    console.log('10. Creando tabla log_integracion_configs si no existe...')
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
    console.log('11. Creando tabla log_integracion_logs si no existe...')
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
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "log_integracion_logs_evento_idx" ON "log_integracion_logs"(evento);`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "log_integracion_logs_estado_idx" ON "log_integracion_logs"(estado);`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "log_integracion_logs_createdAt_idx" ON "log_integracion_logs"("createdAt");`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "log_integracion_logs_rutaId_idx" ON "log_integracion_logs"("rutaId");`)

    // 12. log_parametros
    console.log('12. Creando tabla log_parametros si no existe...')
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

    // Semilla básica si no existen bodegas
    console.log('13. Verificando datos semilla iniciales...')
    const bodegasExist = await prisma.logBodega.count().catch(() => 0)
    let defaultBodegaId = null

    if (bodegasExist === 0) {
        console.log('Sembrando bodega inicial Centro de Distribución Central (CD Metro)...')
        defaultBodegaId = crypto.randomUUID()
        await prisma.$executeRawUnsafe(
            `INSERT INTO "log_bodegas" (id, codigo, nombre, direccion, activa, orden, "createdAt", "updatedAt") 
             VALUES ($1, 'CD-METRO', 'Centro de Distribución Central - Metro', 'Av. Hendaya 1234, Santiago', true, 1, NOW(), NOW())`,
            defaultBodegaId
        )

        // Sembrar andenes para esta bodega
        const andenesDefault = [
            { cod: 'AND-01', nombre: 'Andén 01 - Carga General', tipo: 'GENERAL', orden: 1 },
            { cod: 'AND-02', nombre: 'Andén 02 - Carga General', tipo: 'GENERAL', orden: 2 },
            { cod: 'AND-03', nombre: 'Andén 03 - Refrigerados', tipo: 'REFRIGERADO', orden: 3 },
            { cod: 'AND-04', nombre: 'Andén 04 - Despacho Express', tipo: 'EXCLUSIVO', orden: 4 },
        ]
        for (const a of andenesDefault) {
            await prisma.$executeRawUnsafe(
                `INSERT INTO "log_andenes" (id, "bodegaId", codigo, nombre, "tipoCarga", "estadoOperativo", orden, activo, "createdAt", "updatedAt")
                 VALUES ($1, $2, $3, $4, $5, 'DISPONIBLE', $6, true, NOW(), NOW())`,
                crypto.randomUUID(),
                defaultBodegaId,
                a.cod,
                a.nombre,
                a.tipo,
                a.orden
            )
        }
        console.log('4 andenes sembrados exitosamente.')
    }

    // Sembrar parámetros iniciales si no existen
    const paramExist = await prisma.logParametro.count().catch(() => 0)
    if (paramExist === 0) {
        console.log('Sembrando parámetros logísticos de referencia...')
        const params = [
            { clave: 'TIEMPO_ALERTA_ANDEN_MINUTOS', valor: '45', desc: 'Minutos de permanencia máxima antes de alertar demora en andén', tipo: 'NUMERO' },
            { clave: 'TIEMPO_TOLERANCIA_PORTON_MINUTOS', valor: '30', desc: 'Tolerancia en minutos de espera en portón antes de reasignación', tipo: 'NUMERO' },
            { clave: 'AUTO_NOTIFICAR_TELEGRAM', valor: 'true', desc: 'Notificar automáticamente al chofer vía Telegram al asignar andén', tipo: 'BOOLEANO' },
        ]
        for (const p of params) {
            await prisma.$executeRawUnsafe(
                `INSERT INTO "log_parametros" (id, clave, valor, descripcion, tipo, "updatedAt")
                 VALUES ($1, $2, $3, $4, $5, NOW()) ON CONFLICT (clave) DO NOTHING`,
                crypto.randomUUID(),
                p.clave,
                p.valor,
                p.desc,
                p.tipo
            )
        }
        console.log('Parámetros sembrados exitosamente.')
    }

    // Configuración n8n por defecto si no existe
    const integExist = await prisma.logIntegracionConfig.count().catch(() => 0)
    if (integExist === 0) {
        console.log('Sembrando configuración inicial para webhook N8N...')
        const defaultSecret = crypto.randomBytes(24).toString('hex')
        await prisma.$executeRawUnsafe(
            `INSERT INTO "log_integracion_configs" (id, nombre, provider, "webhookUrl", "secretToken", activo, "eventosSuscritos", "createdAt", "updatedAt")
             VALUES ($1, 'N8N Principal - Despacho & Telegram', 'N8N', 'https://tu-n8n.ejemplo.com/webhook/hendaya-despacho', $2, false, '["RUTA_CREADA","CHOFER_NOTIFICADO","ANDEN_ASIGNADO","DESPACHO_COMPLETO"]', NOW(), NOW())`,
            crypto.randomUUID(),
            defaultSecret
        )
        console.log('Configuración n8n sembrada (inactiva hasta configuración de URL real).')
    }

    console.log('=== Inicialización de Logística y Control de Despacho completada con éxito ===')
}

main()
    .catch((e) => {
        console.error('Error aplicando parche de Logística:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
