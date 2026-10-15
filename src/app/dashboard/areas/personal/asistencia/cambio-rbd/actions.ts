'use server'

import { rawPrisma as prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { decryptPersonalText, cleanRut, hashRut } from '@/lib/personal-crypto'
import { ensurePersonalDotacionTables } from '@/lib/personal-dotacion-db-init'
import { ensurePersonalCambioRbdTables } from '@/lib/personal-cambio-rbd-db-init'
import { getUserEffectiveRbds } from '@/lib/authFilters'
import { logAuditAction } from '@/lib/audit'
import { sendGenericaNotification } from '@/lib/notifications'
import { v4 as uuidv4 } from 'uuid'

const PATH_CAMBIO_RBD = '/dashboard/areas/personal/asistencia/cambio-rbd'

async function checkPermission(): Promise<boolean> {
    const session = await getSession()
    if (!session?.user) return false
    const roleName = session.user.role?.name?.toLowerCase().trim() || ''
    const isAdmin = roleName === 'admin' || roleName === 'administrador'
    const perms = session.user.role?.permissions || []
    return isAdmin || perms.includes('manage_personal_cambio_rbd')
}

export interface CambioRbdRegistroDTO {
    id: string
    colaboradorId?: string | null
    rbdOrigen: number
    establecimientoOrigen?: string | null
    sucursalOrigen?: string | null
    rbdDestino: number
    establecimientoDestino: string
    sucursalDestino?: string | null
    tipoCambio: 'ANEXO_TRASLADO' | 'COMISION_SERVICIO' | string
    fechaDesde: string
    fechaHasta?: string | null
    observacion?: string | null
    estado: string
    creadoPor: string
    createdAt: string
}

export interface ColaboradorDotacionItemDTO {
    id: string
    rut: string
    nombre: string
    rbd: number | null
    establecimiento: string | null
    sucursal: string | null
    supervisor: string | null
    cargo: string | null
    empresa: string | null
    cambiosCount?: number
    ultimoCambio?: CambioRbdRegistroDTO | null
}

export interface ColegioOptionDTO {
    rbd: number
    nombreEstablecimiento: string
    sucursal: string
    comuna?: string
}

/**
 * Consulta la nómina de Dotación de Personal paginada de a 10 registros,
 * aplicando filtrado estricto por los RBDs que el usuario conectado tiene autorizados en su perfil.
 */
export async function getPersonalDotacionCambioRbdAction(params?: {
    page?: number
    pageSize?: number
    sortBy?: string
    sortDir?: 'asc' | 'desc'
    search?: string
}) {
    if (!await checkPermission()) {
        return { success: false, error: 'No tienes permisos para acceder a Cambio de RBD', data: [], total: 0, totalPages: 1 }
    }

    await ensurePersonalDotacionTables()
    await ensurePersonalCambioRbdTables()

    const authorizedRbds = await getUserEffectiveRbds()

    try {
        const whereConditions: string[] = []
        const queryParams: any[] = []
        let paramIndex = 1

        // 1. Filtrado estricto de RBDs autorizados por perfil
        if (authorizedRbds !== null) {
            if (authorizedRbds.length === 0) {
                whereConditions.push(`rbd = -999999`)
            } else {
                whereConditions.push(`rbd = ANY($${paramIndex++})`)
                queryParams.push(authorizedRbds)
            }
        }

        // 2. Búsqueda inteligente por término
        if (params?.search && params.search.trim()) {
            const rawTerm = params.search.trim()
            const numericTerm = parseInt(rawTerm, 10)
            const cleanSearchRut = cleanRut(rawTerm)

            const orSubConditions: string[] = []

            if (!isNaN(numericTerm) && numericTerm > 0) {
                orSubConditions.push(`rbd = ${numericTerm}`)
            }

            if (cleanSearchRut && cleanSearchRut.length >= 7) {
                const rHash = hashRut(cleanSearchRut)
                orSubConditions.push(`"rutHash" = $${paramIndex++}`)
                queryParams.push(rHash)
            }

            orSubConditions.push(`"establecimiento" ILIKE $${paramIndex++}`)
            queryParams.push(`%${rawTerm}%`)

            orSubConditions.push(`"supervisor" ILIKE $${paramIndex++}`)
            queryParams.push(`%${rawTerm}%`)

            orSubConditions.push(`"sucursal" ILIKE $${paramIndex++}`)
            queryParams.push(`%${rawTerm}%`)

            orSubConditions.push(`"cargo" ILIKE $${paramIndex++}`)
            queryParams.push(`%${rawTerm}%`)

            whereConditions.push(`(${orSubConditions.join(' OR ')})`)
        }

        const whereSql = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

        // Total de registros
        const countQuery = `SELECT COUNT(*)::int as count FROM "Pers_Dota_Registro" ${whereSql};`
        const countRes: any[] = await prisma.$queryRawUnsafe(countQuery, ...queryParams)
        const total = countRes[0]?.count || 0

        // Paginación fija de 10 registros
        const page = params?.page && params.page > 0 ? params.page : 1
        const pageSize = params?.pageSize && params.pageSize > 0 ? params.pageSize : 10
        const offset = (page - 1) * pageSize

        // Ordenamiento
        const sortDir = params?.sortDir === 'asc' ? 'ASC' : 'DESC'
        let orderClause = `rbd ${sortDir} NULLS LAST, id ASC`

        if (params?.sortBy === 'rbd') {
            orderClause = `rbd ${sortDir} NULLS LAST, id ASC`
        } else if (params?.sortBy === 'establecimiento') {
            orderClause = `establecimiento ${sortDir} NULLS LAST, id ASC`
        } else if (params?.sortBy === 'sucursal') {
            orderClause = `sucursal ${sortDir} NULLS LAST, id ASC`
        } else if (params?.sortBy === 'supervisor') {
            orderClause = `supervisor ${sortDir} NULLS LAST, id ASC`
        } else if (params?.sortBy === 'cargo') {
            orderClause = `cargo ${sortDir} NULLS LAST, id ASC`
        }

        const dataQuery = `
            SELECT id, "rutEnc", "rutHash", "nombreEnc", rbd, establecimiento, sucursal, supervisor, cargo, empresa
            FROM "Pers_Dota_Registro"
            ${whereSql}
            ORDER BY ${orderClause}
            LIMIT ${pageSize} OFFSET ${offset};
        `
        const rawRows: any[] = await prisma.$queryRawUnsafe(dataQuery, ...queryParams)

        // Consultar movimientos registrados en Pers_Cambio_Rbd para los colaboradores de esta página
        const colabIds = rawRows.map(r => r.id).filter(Boolean)
        const rutHashes = rawRows.map(r => r.rutHash).filter(Boolean)

        const cambiosMap: Record<string, { count: number; ultimo: any }> = {}

        if (colabIds.length > 0 || rutHashes.length > 0) {
            try {
                const cambiosRows: any[] = await prisma.$queryRawUnsafe(`
                    SELECT id, "colaboradorId", "rutHash", "rbdOrigen", "establecimientoOrigen", "sucursalOrigen",
                           "rbdDestino", "establecimientoDestino", "sucursalDestino", "tipoCambio", "fechaDesde", "fechaHasta",
                           observacion, estado, "creadoPor", "createdAt"
                    FROM "Pers_Cambio_Rbd"
                    WHERE "colaboradorId" = ANY($1::text[]) OR "rutHash" = ANY($2::text[])
                    ORDER BY "createdAt" DESC;
                `, colabIds, rutHashes)

                for (const c of cambiosRows) {
                    const keyId = c.colaboradorId
                    const keyHash = c.rutHash

                    if (keyId) {
                        if (!cambiosMap[keyId]) cambiosMap[keyId] = { count: 0, ultimo: null }
                        cambiosMap[keyId].count++
                        if (!cambiosMap[keyId].ultimo) cambiosMap[keyId].ultimo = c
                    }
                    if (keyHash) {
                        if (!cambiosMap[keyHash]) cambiosMap[keyHash] = { count: 0, ultimo: null }
                        if (!keyId || cambiosMap[keyId]?.ultimo?.id !== c.id) {
                            cambiosMap[keyHash].count++
                            if (!cambiosMap[keyHash].ultimo) cambiosMap[keyHash].ultimo = c
                        }
                    }
                }
            } catch (cambioErr) {
                console.error('Error al consultar cambios de RBD para la página:', cambioErr)
            }
        }

        // Descifrado seguro de RUT y Nombre + Asignación de estado de traslados
        const items: ColaboradorDotacionItemDTO[] = rawRows.map(r => {
            const cambioData = (r.id && cambiosMap[r.id]) || (r.rutHash && cambiosMap[r.rutHash]) || null
            return {
                id: r.id,
                rut: decryptPersonalText(r.rutEnc) || '***',
                nombre: decryptPersonalText(r.nombreEnc) || 'Colaborador',
                rbd: r.rbd !== null ? Number(r.rbd) : null,
                establecimiento: r.establecimiento || 'Sin Establecimiento',
                sucursal: r.sucursal || 'Sin Sucursal',
                supervisor: r.supervisor || 'Sin Supervisor',
                cargo: r.cargo || 'Manipuladora',
                empresa: r.empresa || 'HENDAYA',
                cambiosCount: cambioData ? cambioData.count : 0,
                ultimoCambio: cambioData?.ultimo ? {
                    id: cambioData.ultimo.id,
                    colaboradorId: cambioData.ultimo.colaboradorId,
                    rbdOrigen: Number(cambioData.ultimo.rbdOrigen),
                    establecimientoOrigen: cambioData.ultimo.establecimientoOrigen,
                    sucursalOrigen: cambioData.ultimo.sucursalOrigen,
                    rbdDestino: Number(cambioData.ultimo.rbdDestino),
                    establecimientoDestino: cambioData.ultimo.establecimientoDestino,
                    sucursalDestino: cambioData.ultimo.sucursalDestino,
                    tipoCambio: cambioData.ultimo.tipoCambio,
                    fechaDesde: cambioData.ultimo.fechaDesde,
                    fechaHasta: cambioData.ultimo.fechaHasta,
                    observacion: cambioData.ultimo.observacion,
                    estado: cambioData.ultimo.estado,
                    creadoPor: cambioData.ultimo.creadoPor,
                    createdAt: new Date(cambioData.ultimo.createdAt).toISOString()
                } : null
            }
        })

        return {
            success: true,
            data: items,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize) || 1
        }
    } catch (error: any) {
        console.error('Error al consultar dotación para cambio de RBD:', error)
        return { success: false, error: error?.message || 'Error al obtener dotación', data: [], total: 0, totalPages: 1, page: 1, pageSize: 10 }
    }
}

/**
 * Obtiene la lista de colegios candidatos para el cambio de RBD.
 * Prioriza los RBDs asociados al supervisor y complementa con el catálogo oficial de colegios.
 */
export async function getColegiosParaCambioRbdAction(supervisorNombre?: string | null): Promise<ColegioOptionDTO[]> {
    try {
        let supervisorRbdList: number[] = []

        if (supervisorNombre && supervisorNombre.trim()) {
            const cleanSup = supervisorNombre.trim()
            const supMatches = await prisma.supervisor.findMany({
                where: {
                    OR: [
                        { nombre: { contains: cleanSup, mode: 'insensitive' } },
                        { apellido: { contains: cleanSup, mode: 'insensitive' } }
                    ]
                },
                include: { rbdsAuditar: true }
            })

            for (const s of supMatches) {
                if (s.rbdsAuditar && Array.isArray(s.rbdsAuditar)) {
                    for (const r of s.rbdsAuditar) {
                        const num = Number(r.rbd)
                        if (!isNaN(num) && num > 0) supervisorRbdList.push(num)
                    }
                }
            }
        }

        // Obtener colegios de la base de datos
        const colegios = await prisma.colegios.findMany({
            select: {
                colRBD: true,
                nombreEstablecimiento: true,
                sucursal: true,
                comuna: true
            },
            orderBy: [
                { colRBD: 'asc' }
            ],
            take: 1200
        })

        // Mapear opciones unificadas
        const options: ColegioOptionDTO[] = colegios.map(c => ({
            rbd: c.colRBD,
            nombreEstablecimiento: c.nombreEstablecimiento,
            sucursal: c.sucursal || 'CENTRAL',
            comuna: c.comuna || ''
        }))

        // Si hay RBDs del supervisor, ordenarlos prioritariamente
        if (supervisorRbdList.length > 0) {
            const supSet = new Set(supervisorRbdList)
            return options.sort((a, b) => {
                const aIsSup = supSet.has(a.rbd) ? 1 : 0
                const bIsSup = supSet.has(b.rbd) ? 1 : 0
                if (aIsSup !== bIsSup) return bIsSup - aIsSup
                return a.rbd - b.rbd
            })
        }

        return options
    } catch (error) {
        console.error('Error al obtener lista de colegios para popup cambio RBD:', error)
        return []
    }
}

/**
 * Guarda el cambio de RBD (Anexos de traslado o Comisión de servicio)
 * Genera trazabilidad completa en auditoría y dispara la alerta por correo electrónico.
 */
export async function guardarCambioRbdAction(payload: {
    colaboradorId: string
    rbdDestino: number
    tipoCambio: 'ANEXO_TRASLADO' | 'COMISION_SERVICIO'
    fechaDesde: string
    fechaHasta?: string
    observacion?: string
}) {
    if (!await checkPermission()) {
        return { success: false, error: 'No tienes permisos para registrar cambios de RBD' }
    }

    if (!payload.colaboradorId) {
        return { success: false, error: 'Debe seleccionar una colaboradora válida' }
    }

    if (!payload.rbdDestino) {
        return { success: false, error: 'Debe indicar el nuevo RBD de destino' }
    }

    if (!payload.fechaDesde) {
        return { success: false, error: 'La fecha de inicio (Desde) es obligatoria' }
    }

    if (payload.tipoCambio === 'COMISION_SERVICIO' && !payload.fechaHasta) {
        return { success: false, error: 'La Comisión de servicio requiere indicar Fecha Desde y Fecha Hasta' }
    }

    if (payload.fechaHasta && payload.fechaDesde > payload.fechaHasta) {
        return { success: false, error: 'La fecha de término no puede ser anterior a la fecha de inicio' }
    }

    const session = await getSession()
    if (!session?.user) {
        return { success: false, error: 'Sesión no válida o expirada' }
    }

    await ensurePersonalCambioRbdTables()

    try {
        // 1. Obtener datos actuales de la manipuladora en Dotación
        const rows: any[] = await prisma.$queryRawUnsafe(`
            SELECT id, "rutEnc", "rutHash", "nombreEnc", rbd, establecimiento, sucursal, supervisor
            FROM "Pers_Dota_Registro"
            WHERE id = $1
            LIMIT 1;
        `, payload.colaboradorId)

        if (!rows || rows.length === 0) {
            return { success: false, error: 'El registro de dotación de la colaboradora no fue encontrado' }
        }

        const colab = rows[0]
        const rutDecrypted = decryptPersonalText(colab.rutEnc) || '***'
        const nombreDecrypted = decryptPersonalText(colab.nombreEnc) || 'Colaboradora'
        const rbdOrigen = colab.rbd ? Number(colab.rbd) : 0
        const establecimientoOrigen = colab.establecimiento || 'Sin Establecimiento'
        const sucursalOrigen = colab.sucursal || 'Sin Sucursal'
        const supervisor = colab.supervisor || 'Sin Supervisor'

        // 2. Obtener datos del colegio de destino
        const colDestino = await prisma.colegios.findFirst({
            where: { colRBD: payload.rbdDestino },
            select: { nombreEstablecimiento: true, sucursal: true, comuna: true }
        })

        const establecimientoDestino = colDestino?.nombreEstablecimiento || `Colegio RBD ${payload.rbdDestino}`
        const sucursalDestino = colDestino?.sucursal || sucursalOrigen

        // 3. Registrar físicamente en Pers_Cambio_Rbd
        const cambioId = uuidv4()
        await prisma.$executeRawUnsafe(`
            INSERT INTO "Pers_Cambio_Rbd" (
                id, "colaboradorId", "rutEnc", "rutHash", "nombreEnc",
                "rbdOrigen", "establecimientoOrigen", "sucursalOrigen", supervisor,
                "rbdDestino", "establecimientoDestino", "sucursalDestino",
                "tipoCambio", "fechaDesde", "fechaHasta", observacion, estado,
                "creadoPor", "creadoPorId", "createdAt", "updatedAt"
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, $9,
                $10, $11, $12,
                $13, $14, $15, $16, $17,
                $18, $19, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            );
        `,
            cambioId,
            payload.colaboradorId,
            colab.rutEnc,
            colab.rutHash,
            colab.nombreEnc,
            rbdOrigen,
            establecimientoOrigen,
            sucursalOrigen,
            supervisor,
            payload.rbdDestino,
            establecimientoDestino,
            sucursalDestino,
            payload.tipoCambio,
            payload.fechaDesde,
            payload.fechaHasta || null,
            payload.observacion || null,
            'REGISTRADO',
            session.user.name || session.user.username,
            session.user.id || null
        )

        const tipoCambioTexto = payload.tipoCambio === 'ANEXO_TRASLADO' ? 'Anexos de traslado' : 'Comisión de servicio'

        // 4. Auditoría de usuarios
        await logAuditAction({
            username: session.user.username,
            userId: session.user.id,
            action: 'REGISTRO_CAMBIO_RBD',
            modulo: 'Áreas -> Recursos Humanos',
            detalle: `Se registró ${tipoCambioTexto} para ${nombreDecrypted} (${rutDecrypted}): Origen RBD ${rbdOrigen} -> Destino RBD ${payload.rbdDestino} (${establecimientoDestino})`
        })

        // 5. Envío de correo a lista de distribución configurada para 'cambio-rbd-personal'
        const emailTags: Record<string, string> = {
            Rut: rutDecrypted,
            Nombre: nombreDecrypted,
            RbdOrigen: String(rbdOrigen),
            ColegioOrigen: establecimientoOrigen,
            SucursalOrigen: sucursalOrigen,
            RbdDestino: String(payload.rbdDestino),
            ColegioDestino: establecimientoDestino,
            TipoCambio: tipoCambioTexto,
            FechaDesde: payload.fechaDesde,
            FechaHasta: payload.fechaHasta || 'No aplica (Indefinido)',
            Supervisor: supervisor,
            Usuario: session.user.name || session.user.username
        }

        const emailResult = await sendGenericaNotification({
            codigoPantalla: 'cambio-rbd-personal',
            subject: `Alerta Cambio de RBD: ${nombreDecrypted} (RBD ${rbdOrigen} -> ${payload.rbdDestino})`,
            bodyHtml: `
                <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
                    <div style="background: linear-gradient(135deg, #0891b2, #0284c7); padding: 16px 20px; border-radius: 8px; color: #ffffff; margin-bottom: 20px;">
                        <h2 style="margin: 0; font-size: 18px; font-weight: bold;">HENDAYA • Cambio de RBD de Colaboradora</h2>
                        <p style="margin: 4px 0 0; font-size: 12px; opacity: 0.9;">Notificación oficial de Recursos Humanos / Asistencia</p>
                    </div>

                    <p style="font-size: 14px; line-height: 1.5;">Se ha registrado exitosamente un cambio de establecimiento para el siguiente personal:</p>

                    <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 8px; font-weight: bold; color: #64748b; width: 35%;">Colaboradora:</td>
                            <td style="padding: 8px; font-weight: bold; color: #0f172a;">${nombreDecrypted}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 8px; font-weight: bold; color: #64748b;">RUT:</td>
                            <td style="padding: 8px; color: #0f172a;">${rutDecrypted}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 8px; font-weight: bold; color: #64748b;">Modalidad:</td>
                            <td style="padding: 8px;"><span style="display: inline-block; padding: 3px 8px; font-size: 11px; font-weight: bold; border-radius: 6px; background: #e0f2fe; color: #0369a1;">${tipoCambioTexto}</span></td>
                        </tr>
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 8px; font-weight: bold; color: #64748b;">RBD Origen:</td>
                            <td style="padding: 8px; color: #0f172a;">RBD ${rbdOrigen} - ${establecimientoOrigen} (${sucursalOrigen})</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 8px; font-weight: bold; color: #64748b;">RBD Destino:</td>
                            <td style="padding: 8px; font-weight: bold; color: #0284c7;">RBD ${payload.rbdDestino} - ${establecimientoDestino} (${sucursalDestino})</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 8px; font-weight: bold; color: #64748b;">Vigencia:</td>
                            <td style="padding: 8px; color: #0f172a;">Desde: <b>${payload.fechaDesde}</b> ${payload.fechaHasta ? `hasta: <b>${payload.fechaHasta}</b>` : ''}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #f1f5f9;">
                            <td style="padding: 8px; font-weight: bold; color: #64748b;">Supervisor:</td>
                            <td style="padding: 8px; color: #0f172a;">${supervisor}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px; font-weight: bold; color: #64748b;">Registrado por:</td>
                            <td style="padding: 8px; color: #0f172a;">${session.user.name || session.user.username}</td>
                        </tr>
                    </table>

                    ${payload.observacion ? `<div style="background: #f8fafc; border-left: 4px solid #0891b2; padding: 10px 14px; margin-top: 14px; font-size: 12px; color: #475569;"><b>Observación:</b> ${payload.observacion}</div>` : ''}

                    <div style="margin-top: 24px; padding-top: 12px; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8; text-align: center;">
                        Mensaje automático del Sistema Aplicaciones Hendaya • Módulo Recursos Humanos
                    </div>
                </div>
            `,
            tags: emailTags
        }).catch(err => {
            console.error('Error enviando notificación de cambio de RBD:', err)
            return { warning: 'No se pudo enviar correo' }
        })

        revalidatePath(PATH_CAMBIO_RBD)

        return {
            success: true,
            cambioId,
            emailSent: !!emailResult && (emailResult as any).success
        }
    } catch (error: any) {
        console.error('Error al guardar cambio de RBD:', error)
        return { success: false, error: error?.message || 'Error al guardar el cambio de RBD' }
    }
}

/**
 * Obtiene el historial completo de traslados/cambios de RBD de una colaboradora específica.
 */
export async function getHistorialCambiosColaboradorAction(colaboradorId: string, rut?: string): Promise<{
    success: boolean
    data?: CambioRbdRegistroDTO[]
    error?: string
}> {
    if (!await checkPermission()) {
        return { success: false, error: 'No tienes permisos para consultar historial' }
    }
    await ensurePersonalCambioRbdTables()

    try {
        const cleanR = rut ? cleanRut(rut) : ''
        const rHash = cleanR ? hashRut(cleanR) : ''

        const rows: any[] = await prisma.$queryRawUnsafe(`
            SELECT id, "colaboradorId", "rbdOrigen", "establecimientoOrigen", "sucursalOrigen",
                   "rbdDestino", "establecimientoDestino", "sucursalDestino", "tipoCambio", "fechaDesde", "fechaHasta",
                   observacion, estado, "creadoPor", "createdAt"
            FROM "Pers_Cambio_Rbd"
            WHERE "colaboradorId" = $1 OR ($2 != '' AND "rutHash" = $2)
            ORDER BY "createdAt" DESC;
        `, colaboradorId, rHash)

        const data: CambioRbdRegistroDTO[] = rows.map(r => ({
            id: r.id,
            colaboradorId: r.colaboradorId,
            rbdOrigen: Number(r.rbdOrigen),
            establecimientoOrigen: r.establecimientoOrigen,
            sucursalOrigen: r.sucursalOrigen,
            rbdDestino: Number(r.rbdDestino),
            establecimientoDestino: r.establecimientoDestino,
            sucursalDestino: r.sucursalDestino,
            tipoCambio: r.tipoCambio,
            fechaDesde: r.fechaDesde,
            fechaHasta: r.fechaHasta,
            observacion: r.observacion,
            estado: r.estado,
            creadoPor: r.creadoPor,
            createdAt: new Date(r.createdAt).toISOString()
        }))

        return { success: true, data }
    } catch (err: any) {
        console.error('Error al obtener historial de cambios:', err)
        return { success: false, error: err?.message || 'Error al obtener historial' }
    }
}

