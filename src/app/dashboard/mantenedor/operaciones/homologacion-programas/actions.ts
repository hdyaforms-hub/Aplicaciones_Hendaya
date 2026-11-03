'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'
import { getUserEffectiveRbds } from '@/lib/authFilters'
import { logAuditAction } from '@/lib/audit'
import { ensureHomologacionPmpaTable } from '@/lib/homologacion-pmpa-db-init'
import { v4 as uuidv4 } from 'uuid'

const PATH_HOMOLOGACION = '/dashboard/mantenedor/operaciones/homologacion-programas'
const PATH_INGRESO_RACIONES = '/dashboard/ingreso-raciones'
const PATH_CONTROL_CARGAS = '/dashboard/tablero/control-cargas-masivas'

export interface ProgramasHomologacionItemDTO {
    id?: string
    programaPmpa: string
    servicioPmpa: string
    codigoHomologado: string
    descripcion?: string | null
    actualizadoPor?: string | null
    actualizadoAt?: string | null
    totalRegistros: number
    totalRbds: number
}

export interface GetHomologacionResponse {
    success: boolean
    error?: string
    data: ProgramasHomologacionItemDTO[]
    isRestricted: boolean
    allowedRbdsCount: number
    resumen: {
        totalItems: number
        totalHomologados: number
        totalPendientes: number
    }
}

async function checkManagePermission(): Promise<boolean> {
    const session = await getSession()
    if (!session?.user) return false
    const roleName = session.user.role?.name?.toLowerCase().trim() || ''
    const isAdmin = roleName === 'admin' || roleName === 'administrador' || roleName === 'super admin' || roleName.includes('gerencia')
    if (isAdmin) return true
    const permissions = session.user.role?.permissions || []
    return permissions.includes('manage_homologacion_programas') || permissions.includes('view_pmpa')
}

export async function getProgramasHomologacionAction(): Promise<GetHomologacionResponse> {
    const session = await getSession()
    if (!session?.user) {
        return {
            success: false,
            error: 'No has iniciado sesión.',
            data: [],
            isRestricted: false,
            allowedRbdsCount: 0,
            resumen: { totalItems: 0, totalHomologados: 0, totalPendientes: 0 }
        }
    }

    const hasPermission = await checkManagePermission()
    if (!hasPermission) {
        return {
            success: false,
            error: 'No tienes permisos para acceder a la Homologación de Programas.',
            data: [],
            isRestricted: false,
            allowedRbdsCount: 0,
            resumen: { totalItems: 0, totalHomologados: 0, totalPendientes: 0 }
        }
    }

    try {
        await ensureHomologacionPmpaTable()

        const allowedRbds = await getUserEffectiveRbds()
        const isRestricted = allowedRbds !== null
        const allowedCount = allowedRbds ? allowedRbds.length : 0

        // Si es usuario restringido y no tiene RBDs asignados
        if (isRestricted && allowedRbds.length === 0) {
            return {
                success: true,
                data: [],
                isRestricted: true,
                allowedRbdsCount: 0,
                resumen: { totalItems: 0, totalHomologados: 0, totalPendientes: 0 }
            }
        }

        // Consultar combinaciones distintas de programa y servicio en PMPA
        let pmpaRows: Array<{
            programa: string
            servicio: string
            total_reg: number | bigint | string
            total_rbd: number | bigint | string
        }> = []

        if (isRestricted && allowedRbds.length > 0) {
            pmpaRows = await rawPrisma.$queryRawUnsafe(`
                SELECT 
                    TRIM(COALESCE(programa, '')) as programa,
                    TRIM(COALESCE(servicio, '')) as servicio,
                    COUNT(*)::bigint as total_reg,
                    COUNT(DISTINCT rbd)::bigint as total_rbd
                FROM "PMPA"
                WHERE rbd = ANY($1::int[])
                  AND programa IS NOT NULL AND TRIM(programa) <> ''
                GROUP BY TRIM(COALESCE(programa, '')), TRIM(COALESCE(servicio, ''))
                ORDER BY programa ASC, servicio ASC;
            `, allowedRbds)
        } else {
            pmpaRows = await rawPrisma.$queryRawUnsafe(`
                SELECT 
                    TRIM(COALESCE(programa, '')) as programa,
                    TRIM(COALESCE(servicio, '')) as servicio,
                    COUNT(*)::bigint as total_reg,
                    COUNT(DISTINCT rbd)::bigint as total_rbd
                FROM "PMPA"
                WHERE programa IS NOT NULL AND TRIM(programa) <> ''
                GROUP BY TRIM(COALESCE(programa, '')), TRIM(COALESCE(servicio, ''))
                ORDER BY programa ASC, servicio ASC;
            `)
        }

        // Consultar las homologaciones existentes en la tabla
        const homologaciones: Array<{
            id: string
            programaPmpa: string
            servicioPmpa: string
            codigoHomologado: string
            descripcion: string | null
            actualizadoPor: string | null
            actualizadoAt: Date
        }> = await rawPrisma.$queryRawUnsafe(`
            SELECT 
                "id",
                "programaPmpa",
                "servicioPmpa",
                "codigoHomologado",
                "descripcion",
                "actualizadoPor",
                "actualizadoAt"
            FROM "PMPA_Homologacion_Programas";
        `)

        const mapHomologaciones = new Map<string, typeof homologaciones[0]>()
        for (const h of homologaciones) {
            const key = `${h.programaPmpa.trim().toUpperCase()}:::${(h.servicioPmpa || '').trim().toUpperCase()}`
            mapHomologaciones.set(key, h)
        }

        const items: ProgramasHomologacionItemDTO[] = []
        let totalHomologados = 0

        for (const row of pmpaRows) {
            const prog = (row.programa || '').trim()
            const serv = (row.servicio || '').trim()
            const key = `${prog.toUpperCase()}:::${serv.toUpperCase()}`
            const match = mapHomologaciones.get(key)

            const codHomologado = (match?.codigoHomologado || '').trim()
            if (codHomologado) {
                totalHomologados++
            }

            items.push({
                id: match?.id,
                programaPmpa: prog,
                servicioPmpa: serv,
                codigoHomologado: codHomologado,
                descripcion: match?.descripcion || null,
                actualizadoPor: match?.actualizadoPor || null,
                actualizadoAt: match?.actualizadoAt ? new Date(match.actualizadoAt).toISOString() : null,
                totalRegistros: Number(row.total_reg || 0),
                totalRbds: Number(row.total_rbd || 0)
            })
        }

        return {
            success: true,
            data: items,
            isRestricted,
            allowedRbdsCount: allowedCount,
            resumen: {
                totalItems: items.length,
                totalHomologados,
                totalPendientes: items.length - totalHomologados
            }
        }
    } catch (error: any) {
        console.error('Error al obtener programas para homologación:', error)
        return {
            success: false,
            error: error?.message || 'Error al consultar la homologación de programas.',
            data: [],
            isRestricted: false,
            allowedRbdsCount: 0,
            resumen: { totalItems: 0, totalHomologados: 0, totalPendientes: 0 }
        }
    }
}

export async function guardarHomologacionAction(payload: {
    programaPmpa: string
    servicioPmpa: string
    codigoHomologado: string
    descripcion?: string
}): Promise<{ success: boolean; error?: string; id?: string }> {
    const session = await getSession()
    if (!session?.user) {
        return { success: false, error: 'No autorizado' }
    }

    const hasPermission = await checkManagePermission()
    if (!hasPermission) {
        return { success: false, error: 'Permisos insuficientes para modificar homologaciones' }
    }

    try {
        await ensureHomologacionPmpaTable()

        const prog = payload.programaPmpa.trim()
        const serv = (payload.servicioPmpa || '').trim()
        const codHom = payload.codigoHomologado.trim()
        const desc = (payload.descripcion || '').trim() || null
        const username = session.user.username || session.user.name || 'Sistema'
        const userId = session.user.id || undefined
        const ahora = new Date()
        const id = uuidv4()

        await rawPrisma.$executeRawUnsafe(`
            INSERT INTO "PMPA_Homologacion_Programas" (
                "id",
                "programaPmpa",
                "servicioPmpa",
                "codigoHomologado",
                "descripcion",
                "actualizadoPor",
                "actualizadoAt",
                "createdAt"
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
            ON CONFLICT ("programaPmpa", "servicioPmpa")
            DO UPDATE SET
                "codigoHomologado" = EXCLUDED."codigoHomologado",
                "descripcion" = EXCLUDED."descripcion",
                "actualizadoPor" = EXCLUDED."actualizadoPor",
                "actualizadoAt" = EXCLUDED."actualizadoAt";
        `, id, prog, serv, codHom, desc, username, ahora)

        await logAuditAction({
            username,
            userId,
            action: 'HOMOLOGAR_PROGRAMA_PMPA',
            modulo: 'Operaciones',
            detalle: `Homologación para Programa="${prog}", Servicio="${serv || '-'}" -> Código="${codHom || '(Sin código)'}" por usuario ${username}.`
        })

        revalidatePath(PATH_HOMOLOGACION)
        revalidatePath(PATH_INGRESO_RACIONES)
        revalidatePath(PATH_CONTROL_CARGAS)

        return { success: true, id }
    } catch (error: any) {
        console.error('Error al guardar homologación de programa:', error)
        return { success: false, error: error?.message || 'Error al guardar la homologación' }
    }
}

export async function guardarHomologacionesMasivasAction(
    items: Array<{
        programaPmpa: string
        servicioPmpa: string
        codigoHomologado: string
        descripcion?: string
    }>
): Promise<{ success: boolean; error?: string; guardadosCount: number }> {
    const session = await getSession()
    if (!session?.user) {
        return { success: false, error: 'No autorizado', guardadosCount: 0 }
    }

    const hasPermission = await checkManagePermission()
    if (!hasPermission) {
        return { success: false, error: 'Permisos insuficientes para modificar homologaciones', guardadosCount: 0 }
    }

    if (!items || items.length === 0) {
        return { success: true, guardadosCount: 0 }
    }

    try {
        await ensureHomologacionPmpaTable()
        const username = session.user.username || session.user.name || 'Sistema'
        const userId = session.user.id || undefined
        const ahora = new Date()

        let guardadosCount = 0

        for (const item of items) {
            const prog = item.programaPmpa.trim()
            const serv = (item.servicioPmpa || '').trim()
            const codHom = item.codigoHomologado.trim()
            const desc = (item.descripcion || '').trim() || null
            const id = uuidv4()

            await rawPrisma.$executeRawUnsafe(`
                INSERT INTO "PMPA_Homologacion_Programas" (
                    "id",
                    "programaPmpa",
                    "servicioPmpa",
                    "codigoHomologado",
                    "descripcion",
                    "actualizadoPor",
                    "actualizadoAt",
                    "createdAt"
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
                ON CONFLICT ("programaPmpa", "servicioPmpa")
                DO UPDATE SET
                    "codigoHomologado" = EXCLUDED."codigoHomologado",
                    "descripcion" = EXCLUDED."descripcion",
                    "actualizadoPor" = EXCLUDED."actualizadoPor",
                    "actualizadoAt" = EXCLUDED."actualizadoAt";
            `, id, prog, serv, codHom, desc, username, ahora)

            guardadosCount++
        }

        await logAuditAction({
            username,
            userId,
            action: 'HOMOLOGAR_PROGRAMAS_MASIVO',
            modulo: 'Operaciones',
            detalle: `Guardado masivo de ${guardadosCount} homologaciones de programas/servicios PMPA por usuario ${username}.`
        })

        revalidatePath(PATH_HOMOLOGACION)
        revalidatePath(PATH_INGRESO_RACIONES)
        revalidatePath(PATH_CONTROL_CARGAS)

        return { success: true, guardadosCount }
    } catch (error: any) {
        console.error('Error al guardar masivamente homologaciones de programas:', error)
        return { success: false, error: error?.message || 'Error al guardar los cambios masivos', guardadosCount: 0 }
    }
}

