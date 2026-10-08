'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { decryptPersonalText } from '@/lib/personal-crypto'
import { ensurePersonalAsistenciaTables } from '@/lib/personal-db-init'
import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { uploadPath } from '@/lib/storage'

const PATH_ASISTENCIA = '/dashboard/areas/personal/asistencia'

async function checkPermission() {
    const session = await getSession()
    const perms = session?.user?.role?.permissions || []
    return perms.includes('view_personal_asistencia')
}

export interface AsistenciaRegistroDTO {
    id: string
    cargaId: string | null
    rut: string
    apellidos: string
    nombre: string
    nombreCompleto: string
    fecha: string
    fechaTexto: string
    rbd: number
    establecimiento: string
    supervisorNombre: string
    grupoOriginal: string
    cargo: string | null
    permisoParcial: string | null
    criterioId: string | null
    criterioNombre: string | null
    criterioColor?: string | null
    documentoUrl?: string | null
    documentoNombre?: string | null
    documentoSubidoAt?: string | null
    documentoSubidoPor?: string | null
    creadoPor: string
    fechaCreacion: string
    actualizadoPor: string | null
    fechaActualizacion: string | null
    numActualizaciones: number
}

export async function getAsistenciaRegistrosAction(filtros?: {
    rbd?: number
    fechaInicio?: string
    fechaFin?: string
    criterioId?: string | 'SIN_CRITERIO' | 'TODOS'
}) {
    if (!await checkPermission()) {
        return { success: false, error: 'No tienes permisos para visualizar asistencia', data: [] }
    }
    await ensurePersonalAsistenciaTables()

    const session = await getSession()
    const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'
    const userRbds: number[] = Array.isArray(session?.user?.rbds) ? session.user.rbds.map(Number) : []

    const where: any = {}

    // 1. Restricción por RBD del usuario
    if (!isAdmin && userRbds.length > 0) {
        if (filtros?.rbd && userRbds.includes(filtros.rbd)) {
            where.rbd = filtros.rbd
        } else {
            where.rbd = { in: userRbds }
        }
    } else if (filtros?.rbd) {
        where.rbd = filtros.rbd
    }

    // 2. Filtro de fecha
    if (filtros?.fechaInicio || filtros?.fechaFin) {
        if (filtros.fechaInicio && filtros.fechaFin && filtros.fechaInicio === filtros.fechaFin) {
            where.fecha = filtros.fechaInicio
        } else {
            where.fecha = {}
            if (filtros.fechaInicio) where.fecha.gte = filtros.fechaInicio
            if (filtros.fechaFin) where.fecha.lte = filtros.fechaFin
        }
    }

    // 3. Filtro Criterio
    if (filtros?.criterioId && filtros.criterioId !== 'TODOS') {
        if (filtros.criterioId === 'SIN_CRITERIO') {
            where.criterioId = null
        } else {
            where.criterioId = String(filtros.criterioId)
        }
    }

    try {
        const registros: any[] = await (rawPrisma as any).pers_Asis_Registro.findMany({
            where,
            orderBy: [
                { fecha: 'desc' },
                { rbd: 'asc' },
                { id: 'asc' }
            ],
            take: 2000
        })

        // Obtener criterios para mapa de colores
        const criterios: any[] = await (rawPrisma as any).pers_Asis_Criterio.findMany()
        const criterioColorMap = new Map<string, string | null>(criterios.map((c: any) => [c.id, c.color]))

        // Obtener supervisores asociados a RBDs
        const supervisoresRbds: any[] = await (rawPrisma as any).supervisorRbd.findMany({
            include: {
                supervisor: {
                    select: { nombre: true, apellido: true }
                }
            }
        })
        const supervisorMap = new Map<number, string>()
        for (const s of supervisoresRbds) {
            if (s.supervisor) {
                supervisorMap.set(s.rbd, `${s.supervisor.nombre} ${s.supervisor.apellido}`.trim())
            }
        }

        // Desencriptar datos sensibles en memoria
        const result: AsistenciaRegistroDTO[] = registros.map((r: any) => {
            const rut = decryptPersonalText(r.rutEnc)
            const apellidos = decryptPersonalText(r.apellidosEnc)
            const nombre = decryptPersonalText(r.nombreEnc)

            return {
                id: r.id,
                cargaId: r.cargaId,
                rut,
                apellidos,
                nombre,
                nombreCompleto: `${nombre} ${apellidos}`.trim(),
                fecha: r.fecha,
                fechaTexto: r.fecha,
                rbd: r.rbd,
                establecimiento: r.establecimiento,
                supervisorNombre: supervisorMap.get(r.rbd) || 'Sin Asignar',
                grupoOriginal: r.grupoOriginal || '',
                cargo: r.cargo,
                permisoParcial: r.permisoParcial,
                criterioId: r.criterioId,
                criterioNombre: r.criterioNombre,
                criterioColor: r.criterioId ? (criterioColorMap.get(r.criterioId) || '#64748b') : null,
                documentoUrl: r.documentoUrl || null,
                documentoNombre: r.documentoNombre || null,
                documentoSubidoAt: r.documentoSubidoAt ? new Date(r.documentoSubidoAt).toISOString() : null,
                documentoSubidoPor: r.documentoSubidoPor || null,
                creadoPor: r.creadoPor,
                fechaCreacion: r.fechaCreacion ? new Date(r.fechaCreacion).toISOString() : '',
                actualizadoPor: r.actualizadoPor,
                fechaActualizacion: r.fechaActualizacion ? new Date(r.fechaActualizacion).toISOString() : null,
                numActualizaciones: r.numActualizaciones || 0
            }
        })

        return { success: true, data: result }
    } catch (error: any) {
        console.error('Error fetching Pers_Asis_Registro:', error)
        return { success: false, error: error.message || 'Error al obtener registros de asistencia', data: [] }
    }
}

export async function asignarCriterioAction(registroId: string, criterioId: string | null) {
    if (!await checkPermission()) {
        return { success: false, error: 'No tienes permisos para modificar registros de asistencia' }
    }
    await ensurePersonalAsistenciaTables()

    const session = await getSession()
    const usuarioNombre = session?.user?.nombre || session?.user?.email || 'Usuario'

    try {
        let criterioNombre: string | null = null
        if (criterioId) {
            const crit = await (rawPrisma as any).pers_Asis_Criterio.findUnique({
                where: { id: criterioId }
            })
            if (!crit) {
                return { success: false, error: 'Criterio no encontrado' }
            }
            criterioNombre = crit.nombre
        }

        const actualizado = await (rawPrisma as any).pers_Asis_Registro.update({
            where: { id: registroId },
            data: {
                criterioId,
                criterioNombre,
                criterioAsignadoPor: usuarioNombre,
                criterioAsignadoAt: new Date(),
                actualizadoPor: usuarioNombre,
                fechaActualizacion: new Date(),
                numActualizaciones: { increment: 1 }
            }
        })

        revalidatePath(PATH_ASISTENCIA)
        return {
            success: true,
            data: {
                id: actualizado.id,
                criterioId: actualizado.criterioId,
                criterioNombre: actualizado.criterioNombre,
                actualizadoPor: actualizado.actualizadoPor,
                fechaActualizacion: actualizado.fechaActualizacion ? new Date(actualizado.fechaActualizacion).toISOString() : null
            }
        }
    } catch (error: any) {
        console.error('Error assigning criterio:', error)
        return { success: false, error: error.message || 'Error al actualizar criterio' }
    }
}

export async function getEstablecimientosAutocompletadoAction() {
    await ensurePersonalAsistenciaTables()
    const session = await getSession()
    const isAdmin = session?.user?.role?.name === 'Administrador' || session?.user?.role?.name === 'admin'
    const userRbds: number[] = Array.isArray(session?.user?.rbds) ? session.user.rbds.map(Number) : []

    try {
        const where: any = {}
        if (!isAdmin && userRbds.length > 0) {
            where.rbd = { in: userRbds }
        }

        const distinctEstablecimientos: any[] = await (rawPrisma as any).pers_Asis_Registro.findMany({
            where,
            select: {
                rbd: true,
                establecimiento: true
            },
            distinct: ['rbd']
        })

        return {
            success: true,
            data: distinctEstablecimientos.sort((a: any, b: any) => a.establecimiento.localeCompare(b.establecimiento))
        }
    } catch (error: any) {
        console.error('Error fetching distinct establecimientos:', error)
        return { success: false, error: error.message, data: [] }
    }
}

export async function adjuntarDocumentoAsistenciaAction(formData: FormData): Promise<{
    success: boolean
    error?: string
    data?: {
        registroId: string
        documentoUrl: string
        documentoNombre: string
        criterioId: string | null
        criterioNombre: string | null
        actualizadoPor: string
        fechaActualizacion: string
    }
}> {
    if (!await checkPermission()) {
        return { success: false, error: 'No tienes permisos para modificar registros de asistencia' }
    }
    await ensurePersonalAsistenciaTables()

    const session = await getSession()
    const usuarioNombre = session?.user?.nombre || session?.user?.email || 'Usuario'

    const registroId = formData.get('registroId') as string
    const criterioId = (formData.get('criterioId') as string) || null
    const file = formData.get('file') as File | null

    if (!registroId) {
        return { success: false, error: 'ID de registro no especificado' }
    }
    if (!file || !(file instanceof File) || file.size === 0) {
        return { success: false, error: 'Debes seleccionar un archivo válido para adjuntar' }
    }

    try {
        const uploadDir = uploadPath('ausentismo')
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true })
        }

        const safeOriginalName = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, '_')
        const uniqueFileName = `${Date.now()}_${uuidv4().slice(0, 8)}_${safeOriginalName}`
        const filePath = path.join(uploadDir, uniqueFileName)

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)
        fs.writeFileSync(filePath, buffer)

        const documentoUrl = `/uploads/ausentismo/${uniqueFileName}`

        // Obtener nombre del criterio si viene
        let criterioNombre: string | null = null
        if (criterioId) {
            const crit = await (rawPrisma as any).pers_Asis_Criterio.findUnique({
                where: { id: criterioId }
            })
            if (crit) {
                criterioNombre = crit.nombre
            }
        }

        let updated: any
        try {
            updated = await (rawPrisma as any).pers_Asis_Registro.update({
                where: { id: registroId },
                data: {
                    criterioId,
                    criterioNombre,
                    criterioAsignadoPor: usuarioNombre,
                    criterioAsignadoAt: new Date(),
                    documentoUrl,
                    documentoNombre: file.name,
                    documentoSubidoAt: new Date(),
                    documentoSubidoPor: usuarioNombre,
                    actualizadoPor: usuarioNombre,
                    fechaActualizacion: new Date(),
                    numActualizaciones: { increment: 1 }
                }
            })
        } catch {
            await rawPrisma.$executeRawUnsafe(`
                UPDATE "Pers_Asis_Registro"
                SET "criterioId" = $1,
                    "criterioNombre" = $2,
                    "criterioAsignadoPor" = $3,
                    "criterioAsignadoAt" = CURRENT_TIMESTAMP,
                    "documentoUrl" = $4,
                    "documentoNombre" = $5,
                    "documentoSubidoAt" = CURRENT_TIMESTAMP,
                    "documentoSubidoPor" = $3,
                    "actualizadoPor" = $3,
                    "fechaActualizacion" = CURRENT_TIMESTAMP,
                    "numActualizaciones" = "numActualizaciones" + 1
                WHERE id = $6
            `, criterioId, criterioNombre, usuarioNombre, documentoUrl, file.name, registroId)
            const rows: any = await rawPrisma.$queryRawUnsafe(`SELECT * FROM "Pers_Asis_Registro" WHERE id = $1 LIMIT 1`, registroId)
            updated = Array.isArray(rows) && rows[0] ? rows[0] : { id: registroId, criterioId, criterioNombre, actualizadoPor: usuarioNombre, fechaActualizacion: new Date() }
        }

        revalidatePath(PATH_ASISTENCIA)

        return {
            success: true,
            data: {
                registroId: updated.id,
                documentoUrl,
                documentoNombre: file.name,
                criterioId: updated.criterioId,
                criterioNombre: updated.criterioNombre,
                actualizadoPor: updated.actualizadoPor,
                fechaActualizacion: updated.fechaActualizacion ? new Date(updated.fechaActualizacion).toISOString() : new Date().toISOString()
            }
        }
    } catch (error: any) {
        console.error('Error attaching documento asistencia:', error)
        return { success: false, error: error.message || 'Error al guardar archivo adjunto' }
    }
}

export async function eliminarDocumentoAsistenciaAction(registroId: string) {
    if (!await checkPermission()) {
        return { success: false, error: 'No tienes permisos para modificar registros de asistencia' }
    }
    await ensurePersonalAsistenciaTables()

    const session = await getSession()
    const usuarioNombre = session?.user?.nombre || session?.user?.email || 'Usuario'

    try {
        try {
            await (rawPrisma as any).pers_Asis_Registro.update({
                where: { id: registroId },
                data: {
                    documentoUrl: null,
                    documentoNombre: null,
                    documentoSubidoAt: null,
                    documentoSubidoPor: null,
                    actualizadoPor: usuarioNombre,
                    fechaActualizacion: new Date(),
                    numActualizaciones: { increment: 1 }
                }
            })
        } catch {
            await rawPrisma.$executeRawUnsafe(`
                UPDATE "Pers_Asis_Registro"
                SET "documentoUrl" = NULL,
                    "documentoNombre" = NULL,
                    "documentoSubidoAt" = NULL,
                    "documentoSubidoPor" = NULL,
                    "actualizadoPor" = $1,
                    "fechaActualizacion" = CURRENT_TIMESTAMP,
                    "numActualizaciones" = "numActualizaciones" + 1
                WHERE id = $2
            `, usuarioNombre, registroId)
        }

        revalidatePath(PATH_ASISTENCIA)
        return { success: true }
    } catch (error: any) {
        console.error('Error removing document:', error)
        return { success: false, error: error.message || 'Error al eliminar documento' }
    }
}
