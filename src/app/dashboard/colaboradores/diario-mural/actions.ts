'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { logAuditAction } from '@/lib/audit'
import { ensureDiarioMuralTables } from '@/lib/colaboradores/diario-mural-db-init'

export interface DiarioMuralItem {
    id: string
    titulo: string
    contenido: string
    categoria: string
    color: 'yellow' | 'blue' | 'purple' | 'green' | 'pink' | 'orange'
    duracionDias: number
    fechaExpiracion: string
    autorNombre: string
    autorRol: string | null
    diasRestantes: number
    imagenUrl?: string | null
    createdAt: string
}

export interface DiarioMuralResponse {
    success: boolean
    items?: DiarioMuralItem[]
    esAdmin?: boolean
    usuarioActual?: string
    error?: string
}

function checkIsAdmin(session: any): boolean {
    if (!session?.user) return false
    const roleName = (session.user.role?.name || '').toLowerCase().trim()
    const perms: string[] = session.user.role?.permissions || []
    return (
        roleName === 'admin' ||
        roleName === 'administrador' ||
        roleName === 'super admin' ||
        perms.includes('manage_diario_mural') ||
        perms.includes('manage_roles')
    )
}

export async function obtenerDiarioMuralAction(): Promise<DiarioMuralResponse> {
    try {
        const session = await getSession()
        if (!session?.user) {
            return { success: false, error: 'Sesión no iniciada' }
        }

        await ensureDiarioMuralTables()

        // Depurar automáticamente publicaciones vencidas de la pizarra
        await rawPrisma.$executeRawUnsafe(`
            DELETE FROM "diario_mural" WHERE "fechaExpiracion" < NOW();
        `).catch(err => console.warn('[obtenerDiarioMural] Error en purga de vencidos:', err.message))

        const rows = await rawPrisma.$queryRawUnsafe<any[]>(`
            SELECT 
                "id", "titulo", "contenido", "categoria", "color",
                "duracionDias", "imagenUrl", "leidoPor",
                "fechaExpiracion"::text as "fechaExpiracion",
                "autorNombre", "autorRol",
                "createdAt"::text as "createdAt",
                EXTRACT(DAY FROM ("fechaExpiracion" - NOW()))::int as "diasRestantes"
            FROM "diario_mural"
            WHERE "fechaExpiracion" >= NOW()
            ORDER BY "createdAt" DESC;
        `)

        const esAdmin = checkIsAdmin(session)
        const usuarioActual = session.user.name || session.user.username || 'Usuario'
        const currentUsername = session.user.username || session.user.name || ''

        // Marcar automáticamente todas las noticias activas como leídas por el usuario actual
        if (currentUsername) {
            for (const r of rows) {
                let leidos: string[] = []
                try { leidos = JSON.parse(r.leidoPor || '[]') } catch {}
                if (!leidos.includes(currentUsername)) {
                    leidos.push(currentUsername)
                    await rawPrisma.$executeRawUnsafe(`
                        UPDATE "diario_mural" SET "leidoPor" = $1 WHERE "id" = $2;
                    `, JSON.stringify(leidos), r.id).catch(() => {})
                }
            }
        }

        const items: DiarioMuralItem[] = rows.map(r => ({
            id: r.id,
            titulo: r.titulo,
            contenido: r.contenido,
            categoria: r.categoria || 'General',
            color: (r.color || 'yellow') as DiarioMuralItem['color'],
            duracionDias: Number(r.duracionDias || 30),
            fechaExpiracion: r.fechaExpiracion,
            autorNombre: r.autorNombre || 'Anónimo',
            autorRol: r.autorRol || null,
            diasRestantes: Math.max(0, Number(r.diasRestantes ?? 0)),
            imagenUrl: r.imagenUrl || null,
            createdAt: r.createdAt
        }))

        return {
            success: true,
            items,
            esAdmin,
            usuarioActual
        }
    } catch (error: any) {
        console.error('[obtenerDiarioMuralAction] Error:', error)
        return { success: false, error: error.message || 'Error al obtener publicaciones del Diario Mural' }
    }
}

export async function publicarNotaDiarioMuralAction(data: {
    titulo: string
    contenido: string
    categoria?: string
    color?: string
    duracionDias: number
    imagenUrl?: string | null
}): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const session = await getSession()
        if (!session?.user) {
            return { success: false, error: 'Sesión no válida o expirada' }
        }

        const titulo = data.titulo.trim().toUpperCase()
        const contenido = data.contenido.trim()
        const categoria = (data.categoria || 'General').trim()
        const color = ['yellow', 'blue', 'purple', 'green', 'pink', 'orange'].includes(data.color || '')
            ? data.color!
            : 'yellow'
        const imagenUrl = data.imagenUrl || null

        // Duración máxima permitida: 60 días (2 meses)
        const duracionValida = [10, 20, 30, 60].includes(data.duracionDias)
            ? data.duracionDias
            : Math.min(Math.max(1, data.duracionDias || 30), 60)

        if (!titulo) return { success: false, error: 'El título de la nota es obligatorio' }
        if (!contenido) return { success: false, error: 'El contenido o descripción es obligatorio' }

        await ensureDiarioMuralTables()

        const autorNombre = session.user.name || session.user.username || 'Colaborador'
        const autorEmail = session.user.email || null
        const autorRol = session.user.role?.name || 'Colaborador'
        const autorId = session.user.id || null
        const autorUsername = session.user.username || autorNombre

        const id = crypto.randomUUID()
        const hoy = new Date()
        const fechaExpiracion = new Date(hoy.getTime() + duracionValida * 24 * 60 * 60 * 1000)

        // El creador ya la leyó por defecto
        const leidoPorInicial = JSON.stringify([autorUsername])

        await rawPrisma.$executeRawUnsafe(`
            INSERT INTO "diario_mural" (
                "id", "titulo", "contenido", "categoria", "color",
                "duracionDias", "fechaExpiracion", "autorId", "autorNombre",
                "autorEmail", "autorRol", "imagenUrl", "leidoPor", "createdAt", "updatedAt"
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
        `, id, titulo, contenido, categoria, color, duracionValida, fechaExpiracion, autorId, autorNombre, autorEmail, autorRol, imagenUrl, leidoPorInicial)

        await logAuditAction({
            username: autorNombre,
            modulo: 'Colaboradores -> Diario Mural',
            action: 'CREACION',
            detalle: `Publicó nota en Diario Mural: "${titulo}" (Vigencia: ${duracionValida} días${imagenUrl ? ', con imagen adjunta' : ''})`
        })

        return { success: true, id }
    } catch (error: any) {
        console.error('[publicarNotaDiarioMuralAction] Error:', error)
        return { success: false, error: error.message || 'Error al publicar nota en Diario Mural' }
    }
}

export async function marcarDiarioMuralLeidoAction(postId?: string): Promise<{ success: boolean }> {
    try {
        const session = await getSession()
        if (!session?.user) return { success: false }
        const username = session.user.username || session.user.name || ''
        if (!username) return { success: false }

        await ensureDiarioMuralTables()

        if (postId) {
            const rows = await rawPrisma.$queryRawUnsafe<any[]>(`SELECT "leidoPor" FROM "diario_mural" WHERE "id" = $1;`, postId)
            if (rows.length > 0) {
                let leidos: string[] = []
                try { leidos = JSON.parse(rows[0].leidoPor || '[]') } catch {}
                if (!leidos.includes(username)) {
                    leidos.push(username)
                    await rawPrisma.$executeRawUnsafe(`
                        UPDATE "diario_mural" SET "leidoPor" = $1 WHERE "id" = $2;
                    `, JSON.stringify(leidos), postId)
                }
            }
        } else {
            const rows = await rawPrisma.$queryRawUnsafe<any[]>(`SELECT "id", "leidoPor" FROM "diario_mural" WHERE "fechaExpiracion" >= NOW();`)
            for (const r of rows) {
                let leidos: string[] = []
                try { leidos = JSON.parse(r.leidoPor || '[]') } catch {}
                if (!leidos.includes(username)) {
                    leidos.push(username)
                    await rawPrisma.$executeRawUnsafe(`
                        UPDATE "diario_mural" SET "leidoPor" = $1 WHERE "id" = $2;
                    `, JSON.stringify(leidos), r.id)
                }
            }
        }
        return { success: true }
    } catch (e) {
        return { success: false }
    }
}

export async function eliminarNotaDiarioMuralAction(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await getSession()
        if (!session?.user) {
            return { success: false, error: 'Sesión no válida o expirada' }
        }

        const esAdmin = checkIsAdmin(session)
        if (!esAdmin) {
            return {
                success: false,
                error: 'Acceso denegado: El administrador es el único usuario facultado para eliminar publicaciones del Diario Mural'
            }
        }

        await ensureDiarioMuralTables()

        // Obtener datos para auditoría
        const rows = await rawPrisma.$queryRawUnsafe<any[]>(`SELECT "titulo", "autorNombre" FROM "diario_mural" WHERE "id" = $1;`, id)
        const nota = rows[0]

        await rawPrisma.$executeRawUnsafe(`DELETE FROM "diario_mural" WHERE "id" = $1;`, id)

        const usuarioActual = session.user.name || session.user.username || 'Administrador'
        await logAuditAction({
            username: usuarioActual,
            modulo: 'Colaboradores -> Diario Mural',
            action: 'ELIMINACION',
            detalle: `Eliminó nota del Diario Mural: "${nota?.titulo || id}" (publicada por ${nota?.autorNombre || 'desconocido'})`
        })

        return { success: true }
    } catch (error: any) {
        console.error('[eliminarNotaDiarioMuralAction] Error:', error)
        return { success: false, error: error.message || 'Error al eliminar publicación' }
    }
}
