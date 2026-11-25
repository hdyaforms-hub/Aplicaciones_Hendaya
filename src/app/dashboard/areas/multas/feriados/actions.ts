'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { ensureFeriadosTables, feriadosBaseOficiales } from '@/lib/multas/feriados-db-init'
import { invalidarCacheFeriados } from '@/lib/multas/fechas'
import { logAuditAction } from '@/lib/audit'
import { revalidatePath } from 'next/cache'
import { checkMultasPermission } from '@/lib/multas/permisos'

export interface FeriadoDTO {
    id: string
    fecha: string
    descripcion: string
    anio: number
    tipo: 'LEGAL' | 'IRREGULAR' | 'ELECCION' | 'REGIONAL'
    activo: boolean
    createdAt?: string
    updatedAt?: string
}

export async function getFeriadosAction(anio?: number): Promise<{ success: boolean; feriados?: FeriadoDTO[]; error?: string }> {
    try {
        const session = await getSession()
        const { authorized } = await checkMultasPermission(['view_multas_areas', 'manage_ciclo_legal_multas', 'manage_calculos_ee'], session)
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para ver el calendario de feriados.' }
        }

        await ensureFeriadosTables()

        let rows: any[]
        if (typeof anio === 'number' && !isNaN(anio)) {
            rows = await rawPrisma.$queryRawUnsafe(`
                SELECT id, fecha, descripcion, anio, tipo, activo, "createdAt", "updatedAt"
                FROM "Multas_Feriado"
                WHERE anio = $1
                ORDER BY fecha ASC;
            `, anio)
        } else {
            rows = await rawPrisma.$queryRawUnsafe(`
                SELECT id, fecha, descripcion, anio, tipo, activo, "createdAt", "updatedAt"
                FROM "Multas_Feriado"
                ORDER BY fecha ASC;
            `)
        }

        const feriados: FeriadoDTO[] = (rows || []).map(r => ({
            id: r.id,
            fecha: r.fecha,
            descripcion: r.descripcion,
            anio: r.anio,
            tipo: r.tipo as any,
            activo: r.activo,
            createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : undefined,
            updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : undefined
        }))

        return { success: true, feriados }
    } catch (error: any) {
        console.error('Error al obtener feriados:', error)
        return { success: false, error: error.message || 'Error al obtener feriados' }
    }
}

export async function guardarFeriadoAction(data: {
    id?: string
    fecha: string
    descripcion: string
    anio?: number
    tipo: 'LEGAL' | 'IRREGULAR' | 'ELECCION' | 'REGIONAL'
    activo: boolean
}): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await getSession()
        const { authorized } = await checkMultasPermission(['manage_ciclo_legal_multas', 'manage_calculos_ee', 'view_multas_areas'], session)
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para modificar el calendario de feriados.' }
        }

        await ensureFeriadosTables()

        const fechaTrim = data.fecha.trim()
        if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaTrim)) {
            return { success: false, error: 'El formato de fecha debe ser YYYY-MM-DD.' }
        }

        const descripcionTrim = data.descripcion.trim()
        if (!descripcionTrim) {
            return { success: false, error: 'La descripción del feriado es obligatoria.' }
        }

        const anioCalculado = parseInt(fechaTrim.split('-')[0], 10)
        const idFeriado = data.id || `feriado_${fechaTrim}`

        if (data.id) {
            // Actualizar existente
            await rawPrisma.$executeRawUnsafe(`
                UPDATE "Multas_Feriado"
                SET fecha = $1, descripcion = $2, anio = $3, tipo = $4, activo = $5, "updatedAt" = CURRENT_TIMESTAMP
                WHERE id = $6;
            `, fechaTrim, descripcionTrim, anioCalculado, data.tipo, data.activo, data.id)
        } else {
            // Upsert por fecha
            await rawPrisma.$executeRawUnsafe(`
                INSERT INTO "Multas_Feriado" (id, fecha, descripcion, anio, tipo, activo, "createdAt", "updatedAt")
                VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT (fecha) DO UPDATE
                SET descripcion = EXCLUDED.descripcion,
                    tipo = EXCLUDED.tipo,
                    activo = EXCLUDED.activo,
                    "updatedAt" = CURRENT_TIMESTAMP;
            `, idFeriado, fechaTrim, descripcionTrim, anioCalculado, data.tipo, data.activo)
        }

        invalidarCacheFeriados(anioCalculado)

        await logAuditAction({
            username: (session.user.username || session.user.email) as string,
            userId: session.user.id || null,
            action: 'GUARDAR_FERIADO_MULTAS',
            modulo: 'Multas · Calendario de Feriados',
            detalle: `Se registró/actualizó el feriado ${fechaTrim} (${descripcionTrim}, Tipo: ${data.tipo}, Activo: ${data.activo}).`
        })

        revalidatePath('/dashboard/areas/multas/feriados')
        revalidatePath('/dashboard/areas/multas/ciclo-legal')
        revalidatePath('/dashboard/areas/multas/soluciones')

        return { success: true }
    } catch (error: any) {
        console.error('Error al guardar feriado:', error)
        return { success: false, error: error.message || 'Error al guardar feriado' }
    }
}

export async function toggleActivoFeriadoAction(id: string, nuevoActivo: boolean): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await getSession()
        const { authorized } = await checkMultasPermission(['manage_ciclo_legal_multas', 'manage_calculos_ee', 'view_multas_areas'], session)
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para modificar feriados.' }
        }

        await ensureFeriadosTables()

        const rows: any[] = await rawPrisma.$queryRawUnsafe(`
            UPDATE "Multas_Feriado"
            SET activo = $1, "updatedAt" = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING anio, fecha, descripcion;
        `, nuevoActivo, id)

        if (rows && rows.length > 0) {
            invalidarCacheFeriados(rows[0].anio)
        } else {
            invalidarCacheFeriados()
        }

        revalidatePath('/dashboard/areas/multas/feriados')
        return { success: true }
    } catch (error: any) {
        console.error('Error al cambiar estado de feriado:', error)
        return { success: false, error: error.message || 'Error al cambiar estado de feriado' }
    }
}

export async function eliminarFeriadoAction(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await getSession()
        const { authorized } = await checkMultasPermission(['manage_ciclo_legal_multas', 'manage_calculos_ee', 'view_multas_areas'], session)
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para eliminar feriados.' }
        }

        await ensureFeriadosTables()

        const rows: any[] = await rawPrisma.$queryRawUnsafe(`
            DELETE FROM "Multas_Feriado"
            WHERE id = $1
            RETURNING anio, fecha, descripcion;
        `, id)

        if (rows && rows.length > 0) {
            invalidarCacheFeriados(rows[0].anio)
            await logAuditAction({
                username: (session.user.username || session.user.email) as string,
                userId: session.user.id || null,
                action: 'ELIMINAR_FERIADO_MULTAS',
                modulo: 'Multas · Calendario de Feriados',
                detalle: `Se eliminó el feriado ${rows[0].fecha} (${rows[0].descripcion}).`
            })
        } else {
            invalidarCacheFeriados()
        }

        revalidatePath('/dashboard/areas/multas/feriados')
        return { success: true }
    } catch (error: any) {
        console.error('Error al eliminar feriado:', error)
        return { success: false, error: error.message || 'Error al eliminar feriado' }
    }
}

export async function restablecerFeriadosAnioAction(anio: number): Promise<{ success: boolean; creados?: number; error?: string }> {
    try {
        const session = await getSession()
        const { authorized } = await checkMultasPermission(['manage_ciclo_legal_multas', 'manage_calculos_ee', 'view_multas_areas'], session)
        if (!authorized) {
            return { success: false, error: 'No tienes permisos para restablecer feriados.' }
        }

        await ensureFeriadosTables()

        const feriadosAnio = feriadosBaseOficiales.filter(f => f.anio === anio)
        if (feriadosAnio.length === 0) {
            return { success: false, error: `No hay plantilla de feriados oficiales precargada para el año ${anio}. Puedes agregarlos manualmente.` }
        }

        let agregados = 0
        for (const f of feriadosAnio) {
            await rawPrisma.$executeRawUnsafe(`
                INSERT INTO "Multas_Feriado" (id, fecha, descripcion, anio, tipo, activo, "createdAt", "updatedAt")
                VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT (fecha) DO UPDATE
                SET descripcion = EXCLUDED.descripcion,
                    tipo = EXCLUDED.tipo,
                    activo = true,
                    "updatedAt" = CURRENT_TIMESTAMP;
            `, `feriado_${f.fecha}`, f.fecha, f.descripcion, f.anio, f.tipo || 'LEGAL')
            agregados++
        }

        // Limpieza de San Pedro y San Pablo 2025 si existía el lunes 30
        if (anio === 2025) {
            await rawPrisma.$executeRawUnsafe(`
                DELETE FROM "Multas_Feriado" WHERE fecha = '2025-06-30' AND descripcion LIKE '%San Pedro%';
            `).catch(() => {})
        }

        invalidarCacheFeriados(anio)

        await logAuditAction({
            username: (session.user.username || session.user.email) as string,
            userId: session.user.id || null,
            action: 'RESTABLECER_FERIADOS_MULTAS',
            modulo: 'Multas · Calendario de Feriados',
            detalle: `Se restablecieron ${agregados} feriados oficiales para el año ${anio}.`
        })

        revalidatePath('/dashboard/areas/multas/feriados')
        return { success: true, creados: agregados }
    } catch (error: any) {
        console.error('Error al restablecer feriados del año:', error)
        return { success: false, error: error.message || 'Error al restablecer feriados' }
    }
}
