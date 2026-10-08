'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { logAuditAction } from '@/lib/audit'
import { revalidatePath } from 'next/cache'

export async function updateGlobalConfigAction(formData: FormData) {
    const session = await getSession()
    if (!session?.user) {
        return { error: 'No autorizado' }
    }

    const permissions = session.user.role?.permissions || []
    const isAdmin = session.user.role?.name === 'admin' || session.user.role?.name === 'Administrador'

    if (!isAdmin && !permissions.includes('manage_global_config')) {
        return { error: 'No tienes permisos para modificar la configuración global' }
    }

    const sessionTimeoutMinRaw = formData.get('sessionTimeoutMin')
    const sessionTimeoutMin = parseInt(String(sessionTimeoutMinRaw), 10)

    if (isNaN(sessionTimeoutMin) || sessionTimeoutMin < 1 || sessionTimeoutMin > 1440) {
        return { error: 'El tiempo de duración de la sesión debe ser un número entero entre 1 y 1440 minutos (hasta 24 horas).' }
    }

    try {
        const client = (rawPrisma as any).configuracionGlobal
        if (!client) {
            return { error: 'El modelo de configuración no está inicializado. Por favor recarga el servidor.' }
        }

        const updated = await client.upsert({
            where: { id: 'global' },
            create: {
                id: 'global',
                sessionTimeoutMin,
                updatedBy: session.user.username || session.user.name || 'Admin',
            },
            update: {
                sessionTimeoutMin,
                updatedBy: session.user.username || session.user.name || 'Admin',
            }
        })

        await logAuditAction({
            username: session.user.username,
            userId: session.user.id,
            action: 'ACTUALIZAR_CONFIG_GLOBAL',
            modulo: 'Configuración',
            detalle: `Actualizó el tiempo de duración de la sesión a ${sessionTimeoutMin} minutos`,
        })

        revalidatePath('/dashboard/configuracion/global')
        revalidatePath('/dashboard', 'layout')

        return { success: true, config: updated }
    } catch (error: any) {
        console.error('Error al guardar configuración global:', error)
        return { error: 'Error interno al guardar la configuración en la base de datos' }
    }
}

export interface SucursalGlobalConfigItem {
    id: string
    nombre: string
    region: string | null
    comuna: string | null
    direccion: string | null
    tieneSalaReuniones: boolean
    salaCompartidaId: string | null
    salaCompartidaNombre: string | null
    sucursalesQueCompartenConEsta: string[]
}

export async function ensureSucursalSalaReunionesColumn() {
    try {
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Sucursal" ADD COLUMN IF NOT EXISTS "tieneSalaReuniones" BOOLEAN NOT NULL DEFAULT false;`)
        await rawPrisma.$executeRawUnsafe(`ALTER TABLE "Sucursal" ADD COLUMN IF NOT EXISTS "salaCompartidaId" TEXT;`)
        await rawPrisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "sucursal_sala_compartida_idx" ON "Sucursal"("salaCompartidaId");`)
    } catch (e) {
        console.error('Error asegurando columnas tieneSalaReuniones y salaCompartidaId:', e)
    }
}

export async function getSucursalesGlobalConfigAction(): Promise<SucursalGlobalConfigItem[]> {
    try {
        await ensureSucursalSalaReunionesColumn()
        const rows = await rawPrisma.$queryRaw<any[]>`
            SELECT 
                s.id, 
                s.nombre, 
                s.region, 
                s.comuna, 
                s.direccion, 
                COALESCE(s."tieneSalaReuniones", false) as "tieneSalaReuniones",
                s."salaCompartidaId",
                sc.nombre as "salaCompartidaNombre"
            FROM "Sucursal" s
            LEFT JOIN "Sucursal" sc ON s."salaCompartidaId" = sc.id
            ORDER BY s.nombre ASC
        `
        const list: SucursalGlobalConfigItem[] = rows.map(r => ({
            id: r.id,
            nombre: r.nombre,
            region: r.region,
            comuna: r.comuna,
            direccion: r.direccion,
            tieneSalaReuniones: Boolean(r.tieneSalaReuniones),
            salaCompartidaId: r.salaCompartidaId || null,
            salaCompartidaNombre: r.salaCompartidaNombre || null,
            sucursalesQueCompartenConEsta: []
        }))

        // Poblar relación inversa de sucursales que usan la sala de esta sucursal
        list.forEach(item => {
            if (item.salaCompartidaId) {
                const target = list.find(t => t.id === item.salaCompartidaId)
                if (target) {
                    target.sucursalesQueCompartenConEsta.push(item.nombre)
                }
            }
        })

        return list
    } catch (e) {
        console.error('Error obteniendo sucursales en configuracion global:', e)
        return []
    }
}

export async function updateSucursalSalaReunionesAction(sucursalId: string, tieneSalaReuniones: boolean) {
    const session = await getSession()
    if (!session?.user) {
        return { error: 'No autorizado' }
    }

    const permissions = session.user.role?.permissions || []
    const isAdmin = session.user.role?.name === 'admin' || session.user.role?.name === 'Administrador'

    if (!isAdmin && !permissions.includes('manage_global_config')) {
        return { error: 'No tienes permisos para modificar la configuración de sucursales' }
    }

    try {
        await ensureSucursalSalaReunionesColumn()

        const sucursalRows = await rawPrisma.$queryRaw<any[]>`
            SELECT id, nombre FROM "Sucursal" WHERE id = ${sucursalId} LIMIT 1
        `
        const sucursal = sucursalRows[0]
        if (!sucursal) {
            return { error: 'Sucursal no encontrada' }
        }

        await rawPrisma.$executeRawUnsafe(`
            UPDATE "Sucursal"
            SET "tieneSalaReuniones" = $1, "updatedAt" = NOW()
            WHERE id = $2
        `, tieneSalaReuniones, sucursalId)

        await logAuditAction({
            username: session.user.username,
            userId: session.user.id,
            action: 'ACTUALIZAR_SUCURSAL_SALA_REUNIONES',
            modulo: 'Configuración Global',
            detalle: `Modificó opción "Sucursal cuenta con sala de reuniones" a "${tieneSalaReuniones ? 'Sí' : 'No'}" para sucursal ${sucursal.nombre}`
        })

        revalidatePath('/dashboard/configuracion/global')
        revalidatePath('/dashboard/colaboradores/sala-reuniones')

        return { success: true, sucursalId, tieneSalaReuniones, nombre: sucursal.nombre }
    } catch (error: any) {
        console.error('Error al actualizar sucursal tieneSalaReuniones:', error)
        return { error: 'Error interno al actualizar la opción en la base de datos' }
    }
}

export async function updateSucursalSalaCompartidaAction(sucursalId: string, salaCompartidaId: string | null) {
    const session = await getSession()
    if (!session?.user) {
        return { error: 'No autorizado' }
    }

    const permissions = session.user.role?.permissions || []
    const isAdmin = session.user.role?.name === 'admin' || session.user.role?.name === 'Administrador'

    if (!isAdmin && !permissions.includes('manage_global_config')) {
        return { error: 'No tienes permisos para modificar la configuración de sucursales' }
    }

    if (salaCompartidaId && salaCompartidaId === sucursalId) {
        return { error: 'Una sucursal no puede compartir sala consigo misma' }
    }

    try {
        await ensureSucursalSalaReunionesColumn()

        const sucursalRows = await rawPrisma.$queryRaw<any[]>`
            SELECT id, nombre FROM "Sucursal" WHERE id = ${sucursalId} LIMIT 1
        `
        const sucursal = sucursalRows[0]
        if (!sucursal) {
            return { error: 'Sucursal no encontrada' }
        }

        let destinoNombre = ''
        if (salaCompartidaId) {
            const destRows = await rawPrisma.$queryRaw<any[]>`
                SELECT id, nombre FROM "Sucursal" WHERE id = ${salaCompartidaId} LIMIT 1
            `
            if (!destRows[0]) {
                return { error: 'Sucursal destino no encontrada' }
            }
            destinoNombre = destRows[0].nombre
        }

        await rawPrisma.$executeRawUnsafe(`
            UPDATE "Sucursal"
            SET "salaCompartidaId" = $1, "updatedAt" = NOW()
            WHERE id = $2
        `, salaCompartidaId || null, sucursalId)

        const detalleAudit = salaCompartidaId
            ? `Configuró unión/fusión de sala: "${sucursal.nombre}" comparte sala de reuniones con "${destinoNombre}"`
            : `Desasoció sala compartida para "${sucursal.nombre}" (vuelve a sala propia o independiente)`

        await logAuditAction({
            username: session.user.username,
            userId: session.user.id,
            action: 'ACTUALIZAR_SUCURSAL_SALA_COMPARTIDA',
            modulo: 'Configuración Global',
            detalle: detalleAudit
        })

        revalidatePath('/dashboard/configuracion/global')
        revalidatePath('/dashboard/colaboradores/sala-reuniones')

        return { 
            success: true, 
            sucursalId, 
            salaCompartidaId: salaCompartidaId || null, 
            salaCompartidaNombre: destinoNombre || null,
            mensaje: salaCompartidaId 
                ? `¡Listo! "${sucursal.nombre}" ahora comparte sala con "${destinoNombre}".` 
                : `¡Listo! Se desasoció la sala compartida para "${sucursal.nombre}".` 
        }
    } catch (error: any) {
        console.error('Error al actualizar sala compartida:', error)
        return { error: 'Error interno al actualizar la sala compartida en la base de datos' }
    }
}

