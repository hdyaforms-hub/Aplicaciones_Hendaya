'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { ensurePersonalAsistenciaTables } from '@/lib/personal-db-init'
import crypto from 'crypto'

const PATH = '/dashboard/mantenedor/personal/criterios-ausencias'

async function checkPermission() {
    const session = await getSession()
    const perms = session?.user?.role?.permissions || []
    return perms.includes('manage_personal_criterios')
}

export async function getCriteriosAction() {
    await ensurePersonalAsistenciaTables()
    try {
        const list = await (rawPrisma as any).pers_Asis_Criterio.findMany({
            orderBy: { nombre: 'asc' }
        })
        return { success: true, data: list }
    } catch (error: any) {
        console.error('Error fetching Pers_Asis_Criterio:', error)
        return { success: false, error: error.message || 'Error al obtener criterios' }
    }
}

export async function createCriterioAction(formData: {
    nombre: string
    descripcion?: string
    color?: string
    activo?: boolean
    solicitaDocumento?: boolean
}) {
    if (!await checkPermission()) {
        return { success: false, error: 'No tienes permisos para gestionar criterios de ausencias' }
    }
    await ensurePersonalAsistenciaTables()

    const cleanNombre = formData.nombre.trim().toUpperCase()
    if (!cleanNombre) {
        return { success: false, error: 'El nombre del criterio es obligatorio' }
    }

    try {
        const existing = await (rawPrisma as any).pers_Asis_Criterio.findUnique({
            where: { nombre: cleanNombre }
        })
        if (existing) {
            return { success: false, error: `El criterio "${cleanNombre}" ya existe` }
        }

        let nuevo: any
        try {
            nuevo = await (rawPrisma as any).pers_Asis_Criterio.create({
                data: {
                    nombre: cleanNombre,
                    descripcion: formData.descripcion?.trim() || null,
                    color: formData.color || '#0ea5e9',
                    activo: formData.activo !== undefined ? formData.activo : true,
                    solicitaDocumento: Boolean(formData.solicitaDocumento)
                }
            })
        } catch {
            const newId = crypto.randomUUID()
            await rawPrisma.$executeRawUnsafe(`
                INSERT INTO "Pers_Asis_Criterio" (id, nombre, descripcion, color, activo, "solicitaDocumento", "createdAt", "updatedAt")
                VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, newId, cleanNombre, formData.descripcion?.trim() || null, formData.color || '#0ea5e9', formData.activo !== undefined ? formData.activo : true, Boolean(formData.solicitaDocumento))
            const rows: any = await rawPrisma.$queryRawUnsafe(`SELECT * FROM "Pers_Asis_Criterio" WHERE id = $1 LIMIT 1`, newId)
            nuevo = Array.isArray(rows) ? rows[0] : null
        }

        revalidatePath(PATH)
        revalidatePath('/dashboard/areas/personal/asistencia')
        revalidatePath('/dashboard/areas/recursos-humanos/asistencia')
        return { success: true, data: nuevo }
    } catch (error: any) {
        console.error('Error creating Pers_Asis_Criterio:', error)
        return { success: false, error: error.message || 'Error al crear el criterio' }
    }
}

export async function updateCriterioAction(id: string, formData: {
    nombre: string
    descripcion?: string
    color?: string
    activo?: boolean
    solicitaDocumento?: boolean
}) {
    if (!await checkPermission()) {
        return { success: false, error: 'No tienes permisos para gestionar criterios de ausencias' }
    }
    await ensurePersonalAsistenciaTables()

    const cleanNombre = formData.nombre.trim().toUpperCase()
    if (!cleanNombre) {
        return { success: false, error: 'El nombre del criterio es obligatorio' }
    }

    try {
        const duplicate = await (rawPrisma as any).pers_Asis_Criterio.findFirst({
            where: {
                nombre: cleanNombre,
                NOT: { id }
            }
        })
        if (duplicate) {
            return { success: false, error: `Ya existe otro criterio con el nombre "${cleanNombre}"` }
        }

        let actualizado: any
        try {
            actualizado = await (rawPrisma as any).pers_Asis_Criterio.update({
                where: { id },
                data: {
                    nombre: cleanNombre,
                    descripcion: formData.descripcion !== undefined ? (formData.descripcion.trim() || null) : undefined,
                    color: formData.color,
                    activo: formData.activo,
                    solicitaDocumento: formData.solicitaDocumento !== undefined ? Boolean(formData.solicitaDocumento) : undefined
                }
            })
        } catch {
            await rawPrisma.$executeRawUnsafe(`
                UPDATE "Pers_Asis_Criterio" 
                SET nombre = $1,
                    descripcion = $2,
                    color = COALESCE($3, color),
                    activo = COALESCE($4, activo),
                    "solicitaDocumento" = COALESCE($5, "solicitaDocumento"),
                    "updatedAt" = CURRENT_TIMESTAMP
                WHERE id = $6
            `, cleanNombre, formData.descripcion?.trim() || null, formData.color || null, formData.activo !== undefined ? formData.activo : null, formData.solicitaDocumento !== undefined ? Boolean(formData.solicitaDocumento) : null, id)
            const rows: any = await rawPrisma.$queryRawUnsafe(`SELECT * FROM "Pers_Asis_Criterio" WHERE id = $1 LIMIT 1`, id)
            actualizado = Array.isArray(rows) ? rows[0] : null
        }

        // Sincronizar nombre en Pers_Asis_Registro si cambió el nombre
        await (rawPrisma as any).pers_Asis_Registro.updateMany({
            where: { criterioId: id },
            data: { criterioNombre: cleanNombre }
        })

        revalidatePath(PATH)
        revalidatePath('/dashboard/areas/personal/asistencia')
        revalidatePath('/dashboard/areas/recursos-humanos/asistencia')
        return { success: true, data: actualizado }
    } catch (error: any) {
        console.error('Error updating Pers_Asis_Criterio:', error)
        return { success: false, error: error.message || 'Error al actualizar criterio' }
    }
}

export async function toggleCriterioActivoAction(id: string, activo: boolean) {
    if (!await checkPermission()) {
        return { success: false, error: 'No tienes permisos para gestionar criterios de ausencias' }
    }
    await ensurePersonalAsistenciaTables()

    try {
        await rawPrisma.$executeRawUnsafe(
            `UPDATE "Pers_Asis_Criterio" SET activo = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2`,
            Boolean(activo),
            id
        )
        const rows: any = await rawPrisma.$queryRawUnsafe(
            `SELECT * FROM "Pers_Asis_Criterio" WHERE id = $1 LIMIT 1`,
            id
        )
        const item = Array.isArray(rows) && rows[0] ? rows[0] : { id, activo }
        revalidatePath(PATH)
        revalidatePath('/dashboard/areas/personal/asistencia')
        revalidatePath('/dashboard/areas/recursos-humanos/asistencia')
        return { success: true, data: item }
    } catch (error: any) {
        console.error('Error toggling Pers_Asis_Criterio:', error)
        return { success: false, error: error.message || 'Error al cambiar estado' }
    }
}

export async function toggleCriterioSolicitaDocAction(id: string, solicitaDocumento: boolean) {
    if (!await checkPermission()) {
        return { success: false, error: 'No tienes permisos para gestionar criterios de ausencias' }
    }
    await ensurePersonalAsistenciaTables()

    try {
        await rawPrisma.$executeRawUnsafe(
            `UPDATE "Pers_Asis_Criterio" SET "solicitaDocumento" = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2`,
            Boolean(solicitaDocumento),
            id
        )
        const rows: any = await rawPrisma.$queryRawUnsafe(
            `SELECT * FROM "Pers_Asis_Criterio" WHERE id = $1 LIMIT 1`,
            id
        )
        const item = Array.isArray(rows) && rows[0] ? rows[0] : { id, solicitaDocumento: Boolean(solicitaDocumento) }
        revalidatePath(PATH)
        revalidatePath('/dashboard/areas/personal/asistencia')
        revalidatePath('/dashboard/areas/recursos-humanos/asistencia')
        return { success: true, data: item }
    } catch (error: any) {
        console.error('Error toggling solicitaDocumento:', error)
        return { success: false, error: error.message || 'Error al cambiar opción de documento' }
    }
}

export async function deleteCriterioAction(id: string) {
    if (!await checkPermission()) {
        return { success: false, error: 'No tienes permisos para gestionar criterios de ausencias' }
    }
    await ensurePersonalAsistenciaTables()

    try {
        const count = await (rawPrisma as any).pers_Asis_Registro.count({
            where: { criterioId: id }
        })
        if (count > 0) {
            return {
                success: false,
                error: `No se puede eliminar el criterio porque está asociado a ${count} registro(s) de asistencia. Puedes desactivarlo para que no aparezca en nuevas selecciones.`
            }
        }

        await (rawPrisma as any).pers_Asis_Criterio.delete({
            where: { id }
        })

        revalidatePath(PATH)
        revalidatePath('/dashboard/areas/personal/asistencia')
        return { success: true }
    } catch (error: any) {
        console.error('Error deleting Pers_Asis_Criterio:', error)
        return { success: false, error: error.message || 'Error al eliminar criterio' }
    }
}
