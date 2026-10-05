import { prisma } from '@/lib/prisma'

/**
 * Auto-recuperación (self-healing) idempotente para la tabla Cal_ResSan_Registro en PostgreSQL.
 * Cumple con la directriz obligatoria de no usar migraciones destructivas en producción.
 */
export async function ensureResolucionSanitariaTable(): Promise<void> {
    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "Cal_ResSan_Registro" (
                "id" TEXT PRIMARY KEY,
                "licitacion" TEXT,
                "licId" INTEGER,
                "anio" INTEGER NOT NULL,
                "ut" INTEGER NOT NULL,
                "institucion" TEXT NOT NULL,
                "rbd" INTEGER NOT NULL,
                "rbdDv" TEXT,
                "nombreEstablecimiento" TEXT NOT NULL,
                "sucursal" TEXT,
                "comuna" TEXT NOT NULL,
                "estadoResolucion" TEXT NOT NULL DEFAULT 'No Aplica',
                "numeroResolucion" TEXT,
                "documentoUrl" TEXT,
                "documentoNombre" TEXT,
                "observaciones" TEXT,
                "updatedBy" TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "Cal_ResSan_Registro_rbd_anio_key" UNIQUE ("rbd", "anio")
            );
        `)

        // Asegurar que si la columna sucursal no existe, se agregue dinámicamente
        await prisma.$executeRawUnsafe(`ALTER TABLE "Cal_ResSan_Registro" ADD COLUMN IF NOT EXISTS "sucursal" TEXT;`).catch(() => {})

        // Asegurar que si las columnas se crearon con VARCHAR, se amplíen a TEXT
        await prisma.$executeRawUnsafe(`ALTER TABLE "Cal_ResSan_Registro" ALTER COLUMN "institucion" TYPE TEXT;`).catch(() => {})
        await prisma.$executeRawUnsafe(`ALTER TABLE "Cal_ResSan_Registro" ALTER COLUMN "comuna" TYPE TEXT;`).catch(() => {})
        await prisma.$executeRawUnsafe(`ALTER TABLE "Cal_ResSan_Registro" ALTER COLUMN "estadoResolucion" TYPE TEXT;`).catch(() => {})
        await prisma.$executeRawUnsafe(`ALTER TABLE "Cal_ResSan_Registro" ALTER COLUMN "numeroResolucion" TYPE TEXT;`).catch(() => {})
        await prisma.$executeRawUnsafe(`ALTER TABLE "Cal_ResSan_Registro" ALTER COLUMN "rbdDv" TYPE TEXT;`).catch(() => {})
        await prisma.$executeRawUnsafe(`ALTER TABLE "Cal_ResSan_Registro" ALTER COLUMN "updatedBy" TYPE TEXT;`).catch(() => {})

        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cal_ResSan_Registro_anio_idx" ON "Cal_ResSan_Registro"("anio");`)
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cal_ResSan_Registro_licitacion_idx" ON "Cal_ResSan_Registro"("licitacion");`)
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cal_ResSan_Registro_ut_idx" ON "Cal_ResSan_Registro"("ut");`)
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cal_ResSan_Registro_rbd_idx" ON "Cal_ResSan_Registro"("rbd");`)
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cal_ResSan_Registro_sucursal_idx" ON "Cal_ResSan_Registro"("sucursal");`)
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Cal_ResSan_Registro_estadoResolucion_idx" ON "Cal_ResSan_Registro"("estadoResolucion");`)

        // Limpieza automática de RBDs ficticios de sucursales (31, 32, 1101 o nombres con 'sucursal')
        await prisma.$executeRawUnsafe(`
            DELETE FROM "Cal_ResSan_Registro"
            WHERE "rbd" IN (31, 32, 1101)
               OR LOWER("nombreEstablecimiento") LIKE '%sucursal%';
        `).catch(() => {})
    } catch (error) {
        console.error('Error verificando o creando tabla Cal_ResSan_Registro:', error)
    }
}

export const EXCLUDED_RBDS = [31, 32, 1101]

export function isFictitiousRbd(rbd: number, nombre?: string | null): boolean {
    if (EXCLUDED_RBDS.includes(rbd)) return true
    if (nombre && nombre.toLowerCase().includes('sucursal')) return true
    return false
}

/**
 * Rescata y sincroniza los colegios existentes en el sistema hacia el módulo de Resolución Sanitaria para el año especificado.
 * Si el registro ya existe para ese año, actualiza los datos base (nombre, comuna, ut, licitacion, etc.)
 * sin alterar el estado de la resolución, número ni documento adjunto.
 * Omite los RBDs ficticios correspondientes a sucursales (31, 32, 1101 y nombres con 'sucursal').
 */
export async function syncColegiosToResolucionSanitaria(targetAnio?: number): Promise<{ added: number; updated: number; total: number }> {
    await ensureResolucionSanitariaTable()

    const anio = targetAnio || new Date().getFullYear()

    // 1. Obtener todos los colegios activos en el sistema y filtrar ficticios
    const rawColegios = await prisma.colegios.findMany({
        orderBy: { colRBD: 'asc' }
    })

    const colegios = rawColegios.filter(c => !isFictitiousRbd(c.colRBD, c.nombreEstablecimiento))

    if (!colegios || colegios.length === 0) {
        return { added: 0, updated: 0, total: 0 }
    }

    // 2. Obtener mapa de UTs con su Licitación
    const uts = await prisma.uT.findMany({
        include: { licitacion: true }
    })
    const utMap = new Map<number, { licId: number; licitacionNombre: string }>()
    for (const u of uts) {
        utMap.set(u.codUT, {
            licId: u.licId,
            licitacionNombre: u.licitacion?.licitacionHomologada || `Licitación ${u.licId}`
        })
    }

    // 3. Obtener registros existentes para este año
    const existingRecords = await prisma.cal_ResSan_Registro.findMany({
        where: { anio },
        select: { id: true, rbd: true }
    })
    const existingRbdSet = new Set(existingRecords.map(r => r.rbd))

    let added = 0
    let updated = 0

    // 4. Procesar cada colegio
    for (const col of colegios) {
        const utInfo = utMap.get(col.colut)
        const licitacionNombre = utInfo?.licitacionNombre || 'Sin Licitación'
        const licId = utInfo?.licId || null

        if (existingRbdSet.has(col.colRBD)) {
            // Actualizar datos maestros del colegio para este año
            await prisma.cal_ResSan_Registro.updateMany({
                where: {
                    rbd: col.colRBD,
                    anio
                },
                data: {
                    nombreEstablecimiento: col.nombreEstablecimiento.trim(),
                    institucion: col.institucion.trim(),
                    comuna: col.comuna.trim(),
                    ut: col.colut,
                    licitacion: licitacionNombre,
                    licId,
                    rbdDv: col.colRBDDV?.trim() || null
                }
            })
            updated++
        } else {
            // Crear registro inicial con estado 'No Aplica'
            await prisma.cal_ResSan_Registro.create({
                data: {
                    anio,
                    rbd: col.colRBD,
                    rbdDv: col.colRBDDV?.trim() || null,
                    nombreEstablecimiento: col.nombreEstablecimiento.trim(),
                    institucion: col.institucion.trim(),
                    comuna: col.comuna.trim(),
                    ut: col.colut,
                    licitacion: licitacionNombre,
                    licId,
                    estadoResolucion: 'No Aplica',
                    numeroResolucion: null
                }
            })
            added++
        }
    }

    return { added, updated, total: colegios.length }
}

/**
 * Sincroniza un colegio específico en todos los años existentes de Resolución Sanitaria.
 */
export async function syncSingleColegioToResolucionSanitaria(colegioData: {
    colRBD: number
    colRBDDV?: string
    colut: number
    nombreEstablecimiento: string
    institucion: string
    comuna: string
}): Promise<void> {
    await ensureResolucionSanitariaTable()

    // Omitir si es un RBD ficticio de sucursal
    if (isFictitiousRbd(colegioData.colRBD, colegioData.nombreEstablecimiento)) {
        await prisma.cal_ResSan_Registro.deleteMany({
            where: { rbd: colegioData.colRBD }
        })
        return
    }

    const ut = await prisma.uT.findUnique({
        where: { codUT: colegioData.colut },
        include: { licitacion: true }
    })
    const licitacionNombre = ut?.licitacion?.licitacionHomologada || (ut ? `Licitación ${ut.licId}` : 'Sin Licitación')
    const licId = ut?.licId || null

    const currentYear = new Date().getFullYear()

    // Verificar si existe para el año actual
    const existing = await prisma.cal_ResSan_Registro.findUnique({
        where: {
            rbd_anio: {
                rbd: colegioData.colRBD,
                anio: currentYear
            }
        }
    })

    if (!existing) {
        await prisma.cal_ResSan_Registro.create({
            data: {
                anio: currentYear,
                rbd: colegioData.colRBD,
                rbdDv: colegioData.colRBDDV?.trim() || null,
                nombreEstablecimiento: colegioData.nombreEstablecimiento.trim(),
                institucion: colegioData.institucion.trim(),
                comuna: colegioData.comuna.trim(),
                ut: colegioData.colut,
                licitacion: licitacionNombre,
                licId,
                estadoResolucion: 'No Aplica'
            }
        })
    } else {
        // Actualizar datos base en todos los años donde figure este RBD
        await prisma.cal_ResSan_Registro.updateMany({
            where: { rbd: colegioData.colRBD },
            data: {
                nombreEstablecimiento: colegioData.nombreEstablecimiento.trim(),
                institucion: colegioData.institucion.trim(),
                comuna: colegioData.comuna.trim(),
                ut: colegioData.colut,
                licitacion: licitacionNombre,
                licId,
                rbdDv: colegioData.colRBDDV?.trim() || null
            }
        })
    }
}

/**
 * Elimina los registros de Resolución Sanitaria cuando un colegio se elimina por RBD.
 */
export async function deleteColegioFromResolucionSanitaria(rbd: number): Promise<void> {
    await ensureResolucionSanitariaTable()
    await prisma.cal_ResSan_Registro.deleteMany({
        where: { rbd }
    })
}
