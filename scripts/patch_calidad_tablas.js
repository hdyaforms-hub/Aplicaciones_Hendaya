const { PrismaClient } = require('../src/generated/client')
const prisma = new PrismaClient()

async function initCalidadTables() {
    console.log('=== [Calidad] Verificando e inicializando tablas para Calidad en PostgreSQL ===')

    // 1. Cal_PlanillaTransporte
    console.log('1. Verificando tabla Cal_PlanillaTransporte...')
    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Cal_PlanillaTransporte" (
            "id" TEXT PRIMARY KEY,
            "sucursalId" TEXT NOT NULL REFERENCES "Sucursal"("id"),
            "fecha" TIMESTAMP(3) NOT NULL,
            "fechaTexto" VARCHAR(10) NOT NULL,
            "estado" TEXT NOT NULL DEFAULT 'ABIERTO',
            "firmaCalidadUser" VARCHAR(150),
            "firmaCalidadUserId" TEXT,
            "firmaCalidadFecha" TIMESTAMP(3),
            "firmaCalidadDiasAtraso" INTEGER NOT NULL DEFAULT 0,
            "firmaCalidadImg" TEXT,
            "firmaBodegaUser" VARCHAR(150),
            "firmaBodegaUserId" TEXT,
            "firmaBodegaFecha" TIMESTAMP(3),
            "firmaBodegaImg" TEXT,
            "observacionesGenerales" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "Cal_PlanillaTransporte_sucursalId_fechaTexto_key" UNIQUE ("sucursalId", "fechaTexto")
        );
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cal_PlanillaTransporte_sucursalId_idx" ON "Cal_PlanillaTransporte"("sucursalId");`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cal_PlanillaTransporte_fechaTexto_idx" ON "Cal_PlanillaTransporte"("fechaTexto");`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cal_PlanillaTransporte_estado_idx" ON "Cal_PlanillaTransporte"("estado");`)

    // 2. Cal_RegistroTransporte
    console.log('2. Verificando tabla Cal_RegistroTransporte...')
    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Cal_RegistroTransporte" (
            "id" TEXT PRIMARY KEY,
            "planillaId" TEXT NOT NULL REFERENCES "Cal_PlanillaTransporte"("id") ON DELETE CASCADE,
            "patenteEncriptada" TEXT NOT NULL,
            "limpiezaInterior" VARCHAR(20) NOT NULL DEFAULT 'Cumple',
            "limpiezaExterior" VARCHAR(20) NOT NULL DEFAULT 'Cumple',
            "puertaCamara" VARCHAR(20) NOT NULL DEFAULT 'Cumple',
            "piezasSinOxidacion" VARCHAR(20) NOT NULL DEFAULT 'Cumple',
            "equipoCongelacion" VARCHAR(20) NOT NULL DEFAULT 'Cumple',
            "equipoRefrigeracion" VARCHAR(20) NOT NULL DEFAULT 'Cumple',
            "observacion" TEXT,
            "accionCorrectiva" TEXT,
            "creadoPor" VARCHAR(150) NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cal_RegistroTransporte_planillaId_idx" ON "Cal_RegistroTransporte"("planillaId");`)

    // 3. Cal_PlanillaHigienePersonal
    console.log('3. Verificando tabla Cal_PlanillaHigienePersonal...')
    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Cal_PlanillaHigienePersonal" (
            "id" TEXT PRIMARY KEY,
            "sucursalId" TEXT NOT NULL REFERENCES "Sucursal"("id"),
            "fecha" TIMESTAMP(3) NOT NULL,
            "fechaTexto" VARCHAR(10) NOT NULL,
            "estado" TEXT NOT NULL DEFAULT 'ABIERTO',
            "firmaCalidadUser" VARCHAR(150),
            "firmaCalidadUserId" TEXT,
            "firmaCalidadFecha" TIMESTAMP(3),
            "firmaCalidadDiasAtraso" INTEGER NOT NULL DEFAULT 0,
            "firmaCalidadImg" TEXT,
            "firmaBodegaUser" VARCHAR(150),
            "firmaBodegaUserId" TEXT,
            "firmaBodegaFecha" TIMESTAMP(3),
            "firmaBodegaImg" TEXT,
            "observacionesGenerales" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "Cal_PlanillaHigienePersonal_sucursalId_fechaTexto_key" UNIQUE ("sucursalId", "fechaTexto")
        );
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cal_PlanillaHigienePersonal_sucursalId_idx" ON "Cal_PlanillaHigienePersonal"("sucursalId");`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cal_PlanillaHigienePersonal_fechaTexto_idx" ON "Cal_PlanillaHigienePersonal"("fechaTexto");`)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cal_PlanillaHigienePersonal_estado_idx" ON "Cal_PlanillaHigienePersonal"("estado");`)

    // 4. Cal_RegistroHigienePersonal
    console.log('4. Verificando tabla Cal_RegistroHigienePersonal...')
    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Cal_RegistroHigienePersonal" (
            "id" TEXT PRIMARY KEY,
            "planillaId" TEXT NOT NULL REFERENCES "Cal_PlanillaHigienePersonal"("id") ON DELETE CASCADE,
            "nombreEncriptado" TEXT NOT NULL,
            "uniformeLimpio" VARCHAR(20) NOT NULL DEFAULT 'Cumple',
            "zapatosSeguridad" VARCHAR(20) NOT NULL DEFAULT 'Cumple',
            "peloCorto" VARCHAR(20) NOT NULL DEFAULT 'Cumple',
            "usoJockey" VARCHAR(20) NOT NULL DEFAULT 'Cumple',
            "sinJoyas" VARCHAR(20) NOT NULL DEFAULT 'Cumple',
            "unasCortas" VARCHAR(20) NOT NULL DEFAULT 'Cumple',
            "rasurado" VARCHAR(20) NOT NULL DEFAULT 'Cumple',
            "estadoSalud" VARCHAR(50) NOT NULL DEFAULT 'No Aplica',
            "habitosCorrectos" VARCHAR(50) NOT NULL DEFAULT 'No Aplica',
            "heridas" VARCHAR(30) NOT NULL DEFAULT 'Ausencia',
            "observacion" TEXT,
            "accionCorrectiva" TEXT,
            "creadoPor" VARCHAR(150) NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `)
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cal_RegistroHigienePersonal_planillaId_idx" ON "Cal_RegistroHigienePersonal"("planillaId");`)

    console.log('✓ Tablas e índices de Calidad creados / verificados exitosamente.')

    // 5. Permisos para Roles Administrador
    console.log('5. Actualizando permisos en roles de Administrador...')
    const adminRoles = await prisma.role.findMany({
        where: {
            OR: [
                { name: 'Administrador' },
                { name: 'admin' },
                { name: { contains: 'Admin', mode: 'insensitive' } }
            ]
        }
    })

    const newPerms = [
        'view_calidad_transporte_higiene',
        'manage_calidad_transporte_higiene',
        'sign_calidad_transporte_higiene',
        'sign_bodega_transporte_higiene',
        'view_calidad_higiene_personal',
        'manage_calidad_higiene_personal',
        'sign_calidad_higiene_personal',
        'sign_bodega_higiene_personal'
    ]

    for (const r of adminRoles) {
        let current = []
        try { current = JSON.parse(r.permissions || '[]') } catch (e) { current = [] }
        const pSet = new Set(current)
        let changed = false
        for (const p of newPerms) {
            if (!pSet.has(p)) {
                pSet.add(p)
                changed = true
            }
        }
        if (changed) {
            await prisma.role.update({
                where: { id: r.id },
                data: { permissions: JSON.stringify(Array.from(pSet)) }
            })
            console.log(`  ✓ Permisos agregados a rol "${r.name}"`)
        }
    }

    // 6. Plantillas de correo por defecto
    console.log('6. Verificando plantillas de correo...')
    const pTransporte = await prisma.plantillaCorreo.findUnique({
        where: { codigoPantalla: 'calidad-transporte-higiene' }
    })
    if (!pTransporte) {
        await prisma.plantillaCorreo.create({
            data: {
                codigoPantalla: 'calidad-transporte-higiene',
                asunto: 'Cierre Registro Transporte e Higiene - <Sucursal> (<Fecha>)',
                cuerpo: `Estimado Jefe de Bodega,<br/><br/>Se informa que el usuario <b><UsuarioCalidad></b> ha firmado y cerrado el registro de higiene y estado de transporte correspondiente al día <b><Fecha></b> en la sucursal <b><Sucursal></b>.<br/><br/><b>Total de vehículos inspeccionados:</b> <TotalVehiculos><br/><b>Detalle / Desviaciones:</b><br/><Desviaciones><br/><br/>Por favor ingrese al módulo de Calidad para validar y efectuar su firma de conformidad.<br/><br/>Saludos cordiales,<br/><b>Área de Calidad - Hendaya</b>`
            }
        })
        console.log('  ✓ Plantilla "calidad-transporte-higiene" creada.')
    }

    const pHigiene = await prisma.plantillaCorreo.findUnique({
        where: { codigoPantalla: 'calidad-higiene-personal' }
    })
    if (!pHigiene) {
        await prisma.plantillaCorreo.create({
            data: {
                codigoPantalla: 'calidad-higiene-personal',
                asunto: 'Cierre Registro Higiene Personal Transportista - <Sucursal> (<Fecha>)',
                cuerpo: `Estimado Jefe de Bodega,<br/><br/>Se informa que el usuario <b><UsuarioCalidad></b> ha firmado y cerrado el registro de higiene personal y presentación de transportistas correspondiente al día <b><Fecha></b> en la sucursal <b><Sucursal></b>.<br/><br/><b>Total de trabajadores evaluados:</b> <TotalTrabajadores><br/><b>Detalle / Desviaciones:</b><br/><Desviaciones><br/><br/>Por favor ingrese al módulo de Calidad para validar y efectuar su firma de conformidad.<br/><br/>Saludos cordiales,<br/><b>Área de Calidad - Hendaya</b>`
            }
        })
        console.log('  ✓ Plantilla "calidad-higiene-personal" creada.')
    }

    console.log('=== Proceso finalizado exitosamente. Tablas listas para operar en Producción. ===')
}

initCalidadTables()
    .catch((err) => {
        console.error('Error aplicando configuración de tablas:', err)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
