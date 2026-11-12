'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { getUserEffectiveRbds } from '@/lib/authFilters'
import { ensureMultasEETables } from '@/lib/multas-ee-db-init'
import { logAuditAction } from '@/lib/audit'
import { revalidatePath } from 'next/cache'
import {
    parseInstruccionTrabajoEE,
    CANONICAL_EE_ASPECTS,
    extractLicitacionCodes,
    validateLicitacionMatch
} from '@/lib/pdf-instruccion-ee-parser'

async function checkPermission() {
    const session = await getSession()
    if (!session || !session.user) {
        throw new Error('No autorizado: Sesión no válida')
    }

    const roleName = session.user.role?.name?.toLowerCase().trim() || ''
    const perms = session.user.role?.permissions || []

    const isAuthorized =
        roleName === 'administrador' ||
        roleName === 'admin' ||
        roleName === 'super admin' ||
        roleName === 'superadministrador' ||
        perms.includes('manage_multa_instruccion_ee')

    if (!isAuthorized) {
        throw new Error('No autorizado: Requiere permiso para gestionar Instrucción de Trabajo EE')
    }

    return session
}

export interface LicitacionOption {
    licId: number
    licitacionHomologada: string | null
    estado: number
    tieneIT: boolean
    itRevision?: string | null
    itFecha?: string | null
    totalAspectos?: number
}

/**
 * Obtiene las licitaciones disponibles en la plataforma filtradas por los RBDs del usuario.
 */
export async function getLicitacionesParaIT(): Promise<{
    success: boolean
    data: LicitacionOption[]
    error?: string
}> {
    try {
        await checkPermission()
        await ensureMultasEETables()

        const effectiveRbds = await getUserEffectiveRbds()

        let licQueryWhere: any = {}

        if (effectiveRbds !== null) {
            if (effectiveRbds.length === 0) {
                return { success: true, data: [] }
            }
            // Filtrar licitaciones asociadas a los colegios permitidos vía UT
            const colegios = await rawPrisma.colegios.findMany({
                where: { colRBD: { in: effectiveRbds } },
                select: { colut: true }
            })
            const colUts = [...new Set(colegios.map(c => c.colut).filter(Boolean))] as number[]
            const uts = await rawPrisma.uT.findMany({
                where: { codUT: { in: colUts } },
                select: { licId: true }
            })
            const allowedLicIds = [...new Set(uts.map(u => u.licId).filter(Boolean))] as number[]
            licQueryWhere.licId = { in: allowedLicIds }
        }

        const licitaciones = await rawPrisma.licitacion.findMany({
            where: licQueryWhere,
            orderBy: { licId: 'asc' },
            include: {
                itElementosEsenciales: {
                    select: {
                        id: true,
                        numeroRevision: true,
                        fechaRevision: true,
                        detalles: {
                            select: { id: true }
                        }
                    }
                }
            }
        })

        const data: LicitacionOption[] = licitaciones.map(l => ({
            licId: l.licId,
            licitacionHomologada: l.licitacionHomologada,
            estado: l.estado,
            tieneIT: !!l.itElementosEsenciales,
            itRevision: l.itElementosEsenciales?.numeroRevision || null,
            itFecha: l.itElementosEsenciales?.fechaRevision || null,
            totalAspectos: l.itElementosEsenciales?.detalles?.length || 0
        }))

        return { success: true, data }
    } catch (error: any) {
        console.error('Error al obtener licitaciones para IT:', error)
        return { success: false, data: [], error: error.message || 'Error al obtener licitaciones' }
    }
}

/**
 * Obtiene la Instrucción de Trabajo EE completa para una licitación.
 */
export async function getInstruccionTrabajoPorLicitacion(licId: number): Promise<{
    success: boolean
    data?: any
    error?: string
}> {
    try {
        await checkPermission()
        await ensureMultasEETables()

        const cab = await rawPrisma.multas_IT_Elementos_Esenciales_Cab.findUnique({
            where: { licId },
            include: {
                detalles: {
                    orderBy: { orden: 'asc' }
                },
                licitacion: {
                    select: { licId: true, licitacionHomologada: true }
                }
            }
        })

        if (!cab) {
            return { success: true, data: null }
        }

        return {
            success: true,
            data: {
                ...cab,
                aspectosModalidadesJson: cab.aspectosModalidadesJson ? JSON.parse(cab.aspectosModalidadesJson) : {},
                causasImputabilidadJson: cab.causasImputabilidadJson ? JSON.parse(cab.causasImputabilidadJson) : [],
                anexoPesajeJson: cab.anexoPesajeJson ? JSON.parse(cab.anexoPesajeJson) : null,
                anexoFrutasVerdurasJson: cab.anexoFrutasVerdurasJson ? JSON.parse(cab.anexoFrutasVerdurasJson) : null
            }
        }
    } catch (error: any) {
        console.error('Error al obtener IT por licitación:', error)
        return { success: false, error: error.message || 'Error al consultar la IT' }
    }
}

/**
 * Procesa la carga y validación del documento PDF de Instrucción de Trabajo EE.
 */
export async function procesarYCargarInstruccionTrabajoEE(formData: FormData): Promise<{
    success: boolean
    validation?: { isValid: boolean; detected: string; expected: string; reason?: string }
    error?: string
    data?: any
}> {
    try {
        const session = await checkPermission()
        await ensureMultasEETables()

        const licIdStr = formData.get('licId') as string
        if (!licIdStr) {
            return { success: false, error: 'Debe seleccionar una licitación.' }
        }
        const licId = Number(licIdStr)

        const file = formData.get('file') as File | null
        if (!file) {
            return { success: false, error: 'Debe seleccionar o arrastrar un archivo PDF.' }
        }

        const licitacion = await rawPrisma.licitacion.findUnique({
            where: { licId },
            select: { licId: true, licitacionHomologada: true }
        })

        if (!licitacion) {
            return { success: false, error: 'La licitación seleccionada no existe en la plataforma.' }
        }

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const filename = file.name

        // Parsea y valida el documento
        const parseResult = await parseInstruccionTrabajoEE(buffer, filename, licitacion)

        if (!parseResult.success || !parseResult.validation.isValid || !parseResult.data) {
            return {
                success: false,
                validation: parseResult.validation,
                error: parseResult.error || parseResult.validation.reason || 'Documento no válido para la licitación seleccionada'
            }
        }

        const parsed = parseResult.data
        const operatorName = session.user.username || session.user.name || 'Admin'

        // Upsert de la cabecera
        const cab = await rawPrisma.multas_IT_Elementos_Esenciales_Cab.upsert({
            where: { licId },
            create: {
                licId,
                licitacionCodigoPdf: parsed.licitacionCodigoPdf,
                licitacionHomologada: licitacion.licitacionHomologada || parsed.licitacionHomologada,
                codigoDocumento: parsed.codigoDocumento,
                tituloDocumento: parsed.tituloDocumento,
                numeroRevision: parsed.numeroRevision,
                fechaRevision: parsed.fechaRevision,
                totalPaginas: parsed.totalPaginas,
                objetivo: parsed.objetivo,
                alcance: parsed.alcance,
                plazoNotificacionHoras: parsed.plazoNotificacionHoras,
                plazoCorreccionDias: parsed.plazoCorreccionDias,
                aspectosModalidadesJson: JSON.stringify(parsed.aspectosModalidadesJson),
                causasImputabilidadJson: JSON.stringify(parsed.causasImputabilidadJson),
                anexoPesajeJson: JSON.stringify(parsed.anexoPesajeJson),
                anexoFrutasVerdurasJson: JSON.stringify(parsed.anexoFrutasVerdurasJson),
                nombreArchivo: filename,
                cargadoPor: operatorName
            },
            update: {
                licitacionCodigoPdf: parsed.licitacionCodigoPdf,
                licitacionHomologada: licitacion.licitacionHomologada || parsed.licitacionHomologada,
                codigoDocumento: parsed.codigoDocumento,
                tituloDocumento: parsed.tituloDocumento,
                numeroRevision: parsed.numeroRevision,
                fechaRevision: parsed.fechaRevision,
                totalPaginas: parsed.totalPaginas,
                objetivo: parsed.objetivo,
                alcance: parsed.alcance,
                plazoNotificacionHoras: parsed.plazoNotificacionHoras,
                plazoCorreccionDias: parsed.plazoCorreccionDias,
                aspectosModalidadesJson: JSON.stringify(parsed.aspectosModalidadesJson),
                causasImputabilidadJson: JSON.stringify(parsed.causasImputabilidadJson),
                anexoPesajeJson: JSON.stringify(parsed.anexoPesajeJson),
                anexoFrutasVerdurasJson: JSON.stringify(parsed.anexoFrutasVerdurasJson),
                nombreArchivo: filename,
                cargadoPor: operatorName
            }
        })

        // Reemplazar los detalles de aspectos para asegurar consistencia
        await rawPrisma.multas_IT_Elementos_Esenciales_Det.deleteMany({
            where: { cabId: cab.id }
        })

        for (const asp of parsed.aspectos) {
            await rawPrisma.multas_IT_Elementos_Esenciales_Det.create({
                data: {
                    cabId: cab.id,
                    orden: asp.orden,
                    letra: asp.letra,
                    aspecto: asp.aspecto,
                    formaEvaluar: asp.formaEvaluar,
                    periodoCorreccion: asp.periodoCorreccion,
                    tienePeriodoCorreccion: asp.tienePeriodoCorreccion,
                    medioVerificacion: asp.medioVerificacion,
                    consideracionesEspecificas: asp.consideracionesEspecificas || null,
                    pautaSolucionAnexo3: asp.pautaSolucionAnexo3 || null
                }
            })
        }

        // Registrar en Auditoría
        await logAuditAction({
            username: operatorName,
            userId: session.user.id,
            action: 'CARGA_INSTRUCCION_TRABAJO_EE',
            modulo: 'Mantenedor Multas - Instrucción EE',
            detalle: `Cargada y validada IT Elementos Esenciales para Licitación ${licId} (${licitacion.licitacionHomologada || 'S/H'}). Código PDF: ${parsed.licitacionCodigoPdf}. 13 aspectos (A a la M) guardados.`
        })

        revalidatePath('/dashboard/mantenedor/multas/instruccion-trabajo-ee')

        return {
            success: true,
            validation: parseResult.validation,
            data: { id: cab.id, licId, nombreArchivo: filename }
        }
    } catch (error: any) {
        console.error('Error al procesar y cargar IT EE:', error)
        return { success: false, error: error.message || 'Error al procesar la IT' }
    }
}

/**
 * Permite ajustar manualmente la descripción, forma de evaluar o consideraciones de un aspecto.
 */
export async function actualizarAspectoDetalle(
    detId: string,
    payload: {
        aspecto?: string
        formaEvaluar?: string
        medioVerificacion?: string
        consideracionesEspecificas?: string
        pautaSolucionAnexo3?: string
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await checkPermission()
        await ensureMultasEETables()

        const detalle = await rawPrisma.multas_IT_Elementos_Esenciales_Det.findUnique({
            where: { id: detId },
            include: { cab: true }
        })

        if (!detalle) {
            return { success: false, error: 'Aspecto no encontrado' }
        }

        await rawPrisma.multas_IT_Elementos_Esenciales_Det.update({
            where: { id: detId },
            data: {
                aspecto: payload.aspecto !== undefined ? payload.aspecto : detalle.aspecto,
                formaEvaluar: payload.formaEvaluar !== undefined ? payload.formaEvaluar : detalle.formaEvaluar,
                medioVerificacion: payload.medioVerificacion !== undefined ? payload.medioVerificacion : detalle.medioVerificacion,
                consideracionesEspecificas: payload.consideracionesEspecificas !== undefined ? payload.consideracionesEspecificas : detalle.consideracionesEspecificas,
                pautaSolucionAnexo3: payload.pautaSolucionAnexo3 !== undefined ? payload.pautaSolucionAnexo3 : detalle.pautaSolucionAnexo3
            }
        })

        const operatorName = session.user.username || session.user.name || 'Admin'

        await logAuditAction({
            username: operatorName,
            userId: session.user.id,
            action: 'MODIFICAR_ASPECTO_IT_EE',
            modulo: 'Mantenedor Multas - Instrucción EE',
            detalle: `Modificado aspecto Letra ${detalle.letra} de la IT Licitación ${detalle.cab.licId}`
        })

        revalidatePath('/dashboard/mantenedor/multas/instruccion-trabajo-ee')

        return { success: true }
    } catch (error: any) {
        console.error('Error al actualizar aspecto:', error)
        return { success: false, error: error.message || 'Error al actualizar aspecto' }
    }
}

