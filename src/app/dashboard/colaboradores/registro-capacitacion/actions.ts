'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { logAuditAction } from '@/lib/audit'
import { encryptRegCap, decryptRegCap } from '@/lib/capacitacion-crypto'

export interface ParticipanteInput {
    nombre: string
    cargo: string
    rut: string
    firma?: string | null
}

export interface CrearRegistroCapacitacionInput {
    instalacion: string
    licitacion?: string | null
    sucursal?: string | null
    horaDesde: string
    horaHasta: string
    relatorNombre: string
    relatorCargo: string
    tema: string
    firmaRelator?: string | null
    participantes: ParticipanteInput[]
    pdfGenerado?: boolean
}

export interface ActualizarRegistroCapacitacionInput {
    id: string
    instalacion: string
    licitacion?: string | null
    sucursal?: string | null
    horaDesde: string
    horaHasta: string
    relatorNombre: string
    relatorCargo: string
    tema: string
    firmaRelator?: string | null
    participantes: ParticipanteInput[]
    descargarPDF?: boolean
}

export interface ParticipanteView {
    id: string
    numero: number
    nombre: string
    cargo: string
    rut: string
    firma?: string | null
}

export interface RegistroCapacitacionView {
    id: string
    fecha: Date | string
    instalacion: string
    licitacion?: string | null
    sucursal?: string | null
    horaDesde: string
    horaHasta: string
    horario: string
    relatorNombre: string
    relatorCargo: string
    tema: string
    firmaRelator?: string | null
    creadoPor?: string | null
    createdAt: Date | string
    participantesCount?: number
    participantes?: ParticipanteView[]
    pdfGenerado: boolean
    pdfGeneradoAt?: Date | string | null
}

export interface CapacitacionMetadata {
    licitaciones: { licId: number; licitacionHomologada: string | null }[]
    sucursales: { id: string; nombre: string }[]
    uts: { codUT: number; licId: number; sucursalId: string | null }[]
}

/**
 * Obtiene las licitaciones activas, sucursales y Unidades Territoriales (UT) para los criterios de selección
 */
export async function getCapacitacionMetadata(): Promise<CapacitacionMetadata> {
    try {
        const [licitaciones, sucursales, uts] = await Promise.all([
            rawPrisma.licitacion.findMany({
                where: { estado: 1 },
                select: { licId: true, licitacionHomologada: true },
                orderBy: { licId: 'asc' }
            }),
            rawPrisma.sucursal.findMany({
                select: { id: true, nombre: true },
                orderBy: { nombre: 'asc' }
            }),
            rawPrisma.uT.findMany({
                select: { codUT: true, licId: true, sucursalId: true }
            })
        ])
        return { licitaciones, sucursales, uts }
    } catch (error) {
        console.error('Error al obtener metadatos de capacitación:', error)
        return { licitaciones: [], sucursales: [], uts: [] }
    }
}

/**
 * Mecanismo de auto-recuperación (self-healing) para base de datos PostgreSQL.
 * Crea las tablas con prefijo "RegCap_" e índices de forma idempotente sin riesgo destructivo.
 */
export async function ensureRegCapTables(): Promise<void> {
    try {
        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "RegCap_Capacitacion" (
                "id" TEXT PRIMARY KEY,
                "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "instalacion" TEXT NOT NULL,
                "licitacion" TEXT,
                "sucursal" TEXT,
                "horaDesde" VARCHAR(10) NOT NULL,
                "horaHasta" VARCHAR(10) NOT NULL,
                "horario" VARCHAR(50) NOT NULL,
                "relatorNombre" TEXT NOT NULL,
                "relatorCargo" TEXT NOT NULL,
                "tema" TEXT NOT NULL,
                "firmaRelator" TEXT,
                "creadoPor" VARCHAR(150),
                "creadoPorId" TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `)

        // Columnas idempotentes en caso de que la tabla ya existiese previamente
        await rawPrisma.$executeRawUnsafe(`
            ALTER TABLE "RegCap_Capacitacion" ADD COLUMN IF NOT EXISTS "licitacion" TEXT;
            ALTER TABLE "RegCap_Capacitacion" ADD COLUMN IF NOT EXISTS "sucursal" TEXT;
            ALTER TABLE "RegCap_Capacitacion" ADD COLUMN IF NOT EXISTS "pdfGenerado" BOOLEAN NOT NULL DEFAULT FALSE;
            ALTER TABLE "RegCap_Capacitacion" ADD COLUMN IF NOT EXISTS "pdfGeneradoAt" TIMESTAMP(3);
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "RegCap_Capacitacion_fecha_idx" 
            ON "RegCap_Capacitacion"("fecha");
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "RegCap_Capacitacion_licitacion_idx" 
            ON "RegCap_Capacitacion"("licitacion");
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "RegCap_Capacitacion_sucursal_idx" 
            ON "RegCap_Capacitacion"("sucursal");
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "RegCap_Capacitacion_pdfGenerado_idx" 
            ON "RegCap_Capacitacion"("pdfGenerado");
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS "RegCap_Participante" (
                "id" TEXT PRIMARY KEY,
                "registroId" TEXT NOT NULL,
                "numero" INTEGER NOT NULL,
                "nombre" TEXT NOT NULL,
                "cargo" TEXT NOT NULL,
                "rut" TEXT NOT NULL,
                "firma" TEXT,
                "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "RegCap_Participante_registroId_fkey" 
                    FOREIGN KEY ("registroId") REFERENCES "RegCap_Capacitacion"("id") 
                    ON DELETE CASCADE ON UPDATE CASCADE
            );
        `)

        await rawPrisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "RegCap_Participante_registroId_idx" 
            ON "RegCap_Participante"("registroId");
        `)
    } catch (error) {
        console.error('Error al inicializar tablas RegCap_:', error)
    }
}

/**
 * Verifica permisos del usuario en sesión
 */
async function checkPermissions(requiredPerm: string = 'view_registro_capacitacion') {
    const session = await getSession()
    if (!session?.user) {
        throw new Error('No autorizado. Debe iniciar sesión.')
    }

    const roleName = session.user.role?.name?.toLowerCase() || ''
    const userPerms: string[] = (session.user.role as any)?.permissions || []
    const isAdmin = roleName.includes('admin') || userPerms.includes('admin')

    const hasPerm = isAdmin || userPerms.includes(requiredPerm)
    if (!hasPerm) {
        throw new Error(`Permiso insuficiente: Se requiere ${requiredPerm}`)
    }

    return { session, isAdmin, userPerms }
}

/**
 * Obtiene el listado histórico de registros de capacitación con descifrado de relator
 */
export async function getRegistrosCapacitacion(): Promise<{ success: boolean; data?: RegistroCapacitacionView[]; error?: string }> {
    try {
        await checkPermissions('view_registro_capacitacion')
        await ensureRegCapTables()

        // Consulta cruda segura a PostgreSQL para garantizar funcionamiento inmediato
        const rows: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT 
                r."id",
                r."fecha",
                r."instalacion",
                r."licitacion",
                r."sucursal",
                r."horaDesde",
                r."horaHasta",
                r."horario",
                r."relatorNombre",
                r."relatorCargo",
                r."tema",
                r."firmaRelator",
                r."creadoPor",
                r."createdAt",
                r."pdfGenerado",
                r."pdfGeneradoAt",
                COUNT(p."id")::int AS "participantesCount"
            FROM "RegCap_Capacitacion" r
            LEFT JOIN "RegCap_Participante" p ON p."registroId" = r."id"
            GROUP BY r."id"
            ORDER BY r."fecha" DESC, r."createdAt" DESC
        `)

        const data: RegistroCapacitacionView[] = rows.map(r => ({
            id: r.id,
            fecha: r.fecha,
            instalacion: r.instalacion,
            licitacion: r.licitacion || null,
            sucursal: r.sucursal || null,
            horaDesde: r.horaDesde,
            horaHasta: r.horaHasta,
            horario: r.horario,
            relatorNombre: decryptRegCap(r.relatorNombre),
            relatorCargo: r.relatorCargo,
            tema: r.tema,
            firmaRelator: r.firmaRelator,
            creadoPor: r.creadoPor,
            createdAt: r.createdAt,
            participantesCount: Number(r.participantesCount || 0),
            pdfGenerado: Boolean(r.pdfGenerado),
            pdfGeneradoAt: r.pdfGeneradoAt || null
        }))

        return { success: true, data }
    } catch (error: any) {
        console.error('Error al listar capacitaciones:', error)
        return { success: false, error: error.message || 'Error al obtener registros' }
    }
}

/**
 * Obtiene el detalle completo de un registro por su ID (incluyendo todos los participantes desencriptados)
 */
export async function getRegistroCapacitacionById(id: string): Promise<{ success: boolean; data?: RegistroCapacitacionView; error?: string }> {
    try {
        await checkPermissions('view_registro_capacitacion')
        await ensureRegCapTables()

        const regRows: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT * FROM "RegCap_Capacitacion" WHERE "id" = $1 LIMIT 1
        `, id)

        if (!regRows || regRows.length === 0) {
            return { success: false, error: 'Registro de capacitación no encontrado.' }
        }

        const reg = regRows[0]

        const partRows: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT * FROM "RegCap_Participante" WHERE "registroId" = $1 ORDER BY "numero" ASC
        `, id)

        const participantes: ParticipanteView[] = partRows.map(p => ({
            id: p.id,
            numero: p.numero,
            nombre: decryptRegCap(p.nombre),
            cargo: p.cargo,
            rut: decryptRegCap(p.rut),
            firma: p.firma
        }))

        const data: RegistroCapacitacionView = {
            id: reg.id,
            fecha: reg.fecha,
            instalacion: reg.instalacion,
            licitacion: reg.licitacion || null,
            sucursal: reg.sucursal || null,
            horaDesde: reg.horaDesde,
            horaHasta: reg.horaHasta,
            horario: reg.horario,
            relatorNombre: decryptRegCap(reg.relatorNombre),
            relatorCargo: reg.relatorCargo,
            tema: reg.tema,
            firmaRelator: reg.firmaRelator,
            creadoPor: reg.creadoPor,
            createdAt: reg.createdAt,
            participantesCount: participantes.length,
            participantes,
            pdfGenerado: Boolean(reg.pdfGenerado),
            pdfGeneradoAt: reg.pdfGeneradoAt || null
        }

        return { success: true, data }
    } catch (error: any) {
        console.error('Error al obtener detalle de capacitación:', error)
        return { success: false, error: error.message || 'Error al consultar el registro' }
    }
}

/**
 * Crea un nuevo registro de capacitación con fecha de sistema forzada en servidor y datos sensibles encriptados.
 */
export async function crearRegistroCapacitacion(
    input: CrearRegistroCapacitacionInput
): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const { session } = await checkPermissions('manage_registro_capacitacion')
        await ensureRegCapTables()

        // Validaciones del formulario
        if (!input.instalacion || !input.instalacion.trim()) {
            return { success: false, error: 'Debe ingresar la instalación.' }
        }
        if (!input.horaDesde || !input.horaHasta) {
            return { success: false, error: 'Debe ingresar el horario (Desde y Hasta).' }
        }
        if (!input.relatorNombre || !input.relatorNombre.trim()) {
            return { success: false, error: 'Debe ingresar el nombre del relator.' }
        }
        if (!input.relatorCargo || !input.relatorCargo.trim()) {
            return { success: false, error: 'Debe ingresar el cargo del relator.' }
        }
        if (!input.tema || !input.tema.trim()) {
            return { success: false, error: 'Debe ingresar el tema de capacitación.' }
        }
        if (!input.participantes || input.participantes.length === 0) {
            return { success: false, error: 'Debe ingresar al menos un participante.' }
        }

        // Generar identificador único y fecha del sistema (no modificable por el usuario)
        const cryptoRandom = await import('crypto')
        const registroId = cryptoRandom.randomUUID()
        const fechaSistema = new Date()
        const horarioTexto = `${input.horaDesde} a ${input.horaHasta}`

        // Cifrado de datos sensibles del relator
        const relatorNombreEncriptado = encryptRegCap(input.relatorNombre.trim())

        const usuarioActual = session.user.name || session.user.username || 'Usuario Sistema'
        const usuarioId = session.user.id || null
        const esPdfGenerado = input.pdfGenerado === true

        // 1. Insertar Registro Cabecera
        await rawPrisma.$executeRawUnsafe(`
            INSERT INTO "RegCap_Capacitacion" (
                "id", "fecha", "instalacion", "licitacion", "sucursal", "horaDesde", "horaHasta", "horario",
                "relatorNombre", "relatorCargo", "tema", "firmaRelator",
                "creadoPor", "creadoPorId", "pdfGenerado", "pdfGeneradoAt", "createdAt", "updatedAt"
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
        `,
            registroId,
            fechaSistema,
            input.instalacion.trim(),
            input.licitacion?.trim() || null,
            input.sucursal?.trim() || null,
            input.horaDesde.trim(),
            input.horaHasta.trim(),
            horarioTexto,
            relatorNombreEncriptado,
            input.relatorCargo.trim(),
            input.tema.trim(),
            input.firmaRelator || null,
            usuarioActual,
            usuarioId,
            esPdfGenerado,
            esPdfGenerado ? fechaSistema : null
        )

        // 2. Insertar Detalle de Participantes de 1 a N (con datos encriptados y numeración correlativa)
        for (let i = 0; i < input.participantes.length; i++) {
            const p = input.participantes[i]
            const partId = cryptoRandom.randomUUID()
            const numero = i + 1
            const nombreEnc = encryptRegCap(p.nombre.trim())
            const rutEnc = encryptRegCap(p.rut.trim())

            await rawPrisma.$executeRawUnsafe(`
                INSERT INTO "RegCap_Participante" (
                    "id", "registroId", "numero", "nombre", "cargo", "rut", "firma", "createdAt"
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP
                )
            `,
                partId,
                registroId,
                numero,
                nombreEnc,
                p.cargo.trim(),
                rutEnc,
                p.firma || null
            )
        }

        // 3. Registrar en Auditoría
        const infoLicSuc = [
            input.licitacion ? `Lic: ${input.licitacion}` : '',
            input.sucursal ? `Sucursal: ${input.sucursal}` : ''
        ].filter(Boolean).join(' | ')

        await logAuditAction({
            username: usuarioActual,
            userId: usuarioId,
            action: 'CREAR_REGISTRO_CAPACITACION',
            modulo: 'Colaboradores - Registro de Capacitación',
            detalle: `Se registró capacitación ${infoLicSuc ? `[${infoLicSuc}] ` : ''}en "${input.instalacion.trim()}" con relator "${input.relatorNombre.trim()}" (${input.relatorCargo.trim()}) y ${input.participantes.length} participantes registrados. Tema: ${input.tema.trim().slice(0, 100)}.`
        })

        return { success: true, id: registroId }
    } catch (error: any) {
        console.error('Error al crear registro de capacitación:', error)
        return { success: false, error: error.message || 'Error al guardar el registro' }
    }
}

/**
 * Elimina un registro de capacitación y sus participantes (requiere privilegios de gestión)
 */
export async function eliminarRegistroCapacitacion(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { session, isAdmin } = await checkPermissions('manage_registro_capacitacion')
        await ensureRegCapTables()

        // Obtener datos para auditoría y verificación de bloqueo
        const existing: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT "instalacion", "tema", "creadoPor", "pdfGenerado" FROM "RegCap_Capacitacion" WHERE "id" = $1
        `, id)

        if (!existing || existing.length === 0) {
            return { success: false, error: 'El registro no existe o ya fue eliminado.' }
        }

        // Si ya se emitió el PDF oficial y el usuario NO es administrador, se bloquea la eliminación
        if (existing[0].pdfGenerado && !isAdmin) {
            return {
                success: false,
                error: 'Este registro ya cuenta con su documento oficial en PDF emitido y está bloqueado. Por normativa de seguridad, solo un Administrador puede eliminarlo.'
            }
        }

        await rawPrisma.$executeRawUnsafe(`
            DELETE FROM "RegCap_Capacitacion" WHERE "id" = $1
        `, id)

        const usuarioActual = session.user.name || session.user.username || 'Usuario Sistema'
        await logAuditAction({
            username: usuarioActual,
            userId: session.user.id || null,
            action: 'ELIMINAR_REGISTRO_CAPACITACION',
            modulo: 'Colaboradores - Registro de Capacitación',
            detalle: `Se eliminó el registro de capacitación ID: ${id} correspondiente a la instalación "${existing[0].instalacion}".${existing[0].pdfGenerado ? ' (Eliminado por Administrador tras emisión de PDF)' : ''}`
        })

        return { success: true }
    } catch (error: any) {
        console.error('Error al eliminar registro de capacitación:', error)
        return { success: false, error: error.message || 'Error al eliminar el registro' }
    }
}

/**
 * Actualiza un registro existente siempre que NO se haya emitido su PDF oficial
 */
export async function actualizarRegistroCapacitacion(
    input: ActualizarRegistroCapacitacionInput
): Promise<{ success: boolean; error?: string }> {
    try {
        const { session } = await checkPermissions('manage_registro_capacitacion')
        await ensureRegCapTables()

        // 1. Verificar si el registro existe y si ya tiene PDF emitido (bloqueado)
        const existing: any[] = await rawPrisma.$queryRawUnsafe(`
            SELECT "id", "instalacion", "pdfGenerado" FROM "RegCap_Capacitacion" WHERE "id" = $1 LIMIT 1
        `, input.id)

        if (!existing || existing.length === 0) {
            return { success: false, error: 'Registro de capacitación no encontrado.' }
        }

        if (existing[0].pdfGenerado) {
            return {
                success: false,
                error: 'Este registro ya cuenta con su documento oficial en PDF (R PE 7 06) emitido. Por normativa no puede ser modificado.'
            }
        }

        // Validaciones
        if (!input.instalacion?.trim()) {
            return { success: false, error: 'Debe especificar una instalación o sede.' }
        }
        if (!input.horaDesde || !input.horaHasta) {
            return { success: false, error: 'Debe especificar el horario completo.' }
        }
        if (!input.relatorNombre?.trim()) {
            return { success: false, error: 'Debe ingresar el nombre del relator.' }
        }
        if (!input.tema?.trim()) {
            return { success: false, error: 'Debe ingresar el tema de capacitación.' }
        }
        if (!input.participantes || input.participantes.length === 0) {
            return { success: false, error: 'Debe ingresar al menos un participante.' }
        }

        const horarioTexto = `${input.horaDesde} a ${input.horaHasta}`
        const relatorNombreEncriptado = encryptRegCap(input.relatorNombre.trim())
        const cryptoRandom = await import('crypto')
        const marcarPDF = input.descargarPDF === true

        // 2. Actualizar datos de cabecera
        if (marcarPDF) {
            await rawPrisma.$executeRawUnsafe(`
                UPDATE "RegCap_Capacitacion" SET
                    "instalacion" = $1,
                    "licitacion" = $2,
                    "sucursal" = $3,
                    "horaDesde" = $4,
                    "horaHasta" = $5,
                    "horario" = $6,
                    "relatorNombre" = $7,
                    "relatorCargo" = $8,
                    "tema" = $9,
                    "firmaRelator" = COALESCE($10, "firmaRelator"),
                    "pdfGenerado" = TRUE,
                    "pdfGeneradoAt" = CURRENT_TIMESTAMP,
                    "updatedAt" = CURRENT_TIMESTAMP
                WHERE "id" = $11
            `,
                input.instalacion.trim(),
                input.licitacion?.trim() || null,
                input.sucursal?.trim() || null,
                input.horaDesde.trim(),
                input.horaHasta.trim(),
                horarioTexto,
                relatorNombreEncriptado,
                input.relatorCargo.trim(),
                input.tema.trim(),
                input.firmaRelator || null,
                input.id
            )
        } else {
            await rawPrisma.$executeRawUnsafe(`
                UPDATE "RegCap_Capacitacion" SET
                    "instalacion" = $1,
                    "licitacion" = $2,
                    "sucursal" = $3,
                    "horaDesde" = $4,
                    "horaHasta" = $5,
                    "horario" = $6,
                    "relatorNombre" = $7,
                    "relatorCargo" = $8,
                    "tema" = $9,
                    "firmaRelator" = COALESCE($10, "firmaRelator"),
                    "updatedAt" = CURRENT_TIMESTAMP
                WHERE "id" = $11
            `,
                input.instalacion.trim(),
                input.licitacion?.trim() || null,
                input.sucursal?.trim() || null,
                input.horaDesde.trim(),
                input.horaHasta.trim(),
                horarioTexto,
                relatorNombreEncriptado,
                input.relatorCargo.trim(),
                input.tema.trim(),
                input.firmaRelator || null,
                input.id
            )
        }

        // 3. Reemplazar los participantes (eliminar anteriores e insertar la lista actualizada)
        await rawPrisma.$executeRawUnsafe(`
            DELETE FROM "RegCap_Participante" WHERE "registroId" = $1
        `, input.id)

        for (let i = 0; i < input.participantes.length; i++) {
            const p = input.participantes[i]
            const partId = cryptoRandom.randomUUID()
            const numero = i + 1
            const nombreEnc = encryptRegCap(p.nombre.trim())
            const rutEnc = encryptRegCap(p.rut.trim())

            await rawPrisma.$executeRawUnsafe(`
                INSERT INTO "RegCap_Participante" (
                    "id", "registroId", "numero", "nombre", "cargo", "rut", "firma", "createdAt"
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP
                )
            `,
                partId,
                input.id,
                numero,
                nombreEnc,
                p.cargo.trim(),
                rutEnc,
                p.firma || null
            )
        }

        // 4. Auditoría
        const usuarioActual = session.user.name || session.user.username || 'Usuario Sistema'
        await logAuditAction({
            username: usuarioActual,
            userId: session.user.id || null,
            action: 'ACTUALIZAR_REGISTRO_CAPACITACION',
            modulo: 'Colaboradores - Registro de Capacitación',
            detalle: `Se actualizó el registro ID: ${input.id} (${input.instalacion}). Participantes: ${input.participantes.length}.${marcarPDF ? ' Se emitió PDF oficial (Bloqueado permanentemente).' : ''}`
        })

        return { success: true }
    } catch (error: any) {
        console.error('Error al actualizar registro de capacitación:', error)
        return { success: false, error: error.message || 'Error al actualizar el registro' }
    }
}

/**
 * Marca el registro como descargado/bloqueado y registra la auditoría correspondiente
 */
export async function marcarPDFDescargado(id: string, tema: string): Promise<{ success: boolean; error?: string }> {
    try {
        await checkPermissions('view_registro_capacitacion')
        await ensureRegCapTables()

        await rawPrisma.$executeRawUnsafe(`
            UPDATE "RegCap_Capacitacion" SET
                "pdfGenerado" = TRUE,
                "pdfGeneradoAt" = COALESCE("pdfGeneradoAt", CURRENT_TIMESTAMP),
                "updatedAt" = CURRENT_TIMESTAMP
            WHERE "id" = $1
        `, id)

        await registrarAuditoriaDescarga(id, tema)
        return { success: true }
    } catch (error: any) {
        console.error('Error al marcar PDF como descargado:', error)
        return { success: false, error: error.message }
    }
}

/**
 * Registra en auditoría la acción de descarga del PDF oficial
 */
export async function registrarAuditoriaDescarga(id: string, tema: string): Promise<void> {
    try {
        const session = await getSession()
        if (!session?.user) return

        const usuarioActual = session.user.name || session.user.username || 'Usuario Sistema'
        await logAuditAction({
            username: usuarioActual,
            userId: session.user.id || null,
            action: 'DESCARGA_PDF_CAPACITACION',
            modulo: 'Colaboradores - Registro de Capacitación',
            detalle: `Descargó el documento oficial en PDF (R PE 7 06) del registro ID: ${id}. Tema: ${tema.slice(0, 100)}.`
        })
    } catch (error) {
        console.error('Error al registrar auditoría de descarga:', error)
    }
}
