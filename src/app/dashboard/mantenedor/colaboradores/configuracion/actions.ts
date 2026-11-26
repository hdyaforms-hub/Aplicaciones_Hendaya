'use server'

import { rawPrisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { logAuditAction } from '@/lib/audit'
import { ensureNoticiasTables } from '@/lib/colaboradores/noticias-db-init'

export interface NoticiaAdminItem {
    id: string
    titulo: string
    fuente: string
    link: string
    orden: number
    activo: boolean
    esAutomatica: boolean
    resumen: string | null
    fechaPublicacion: string | null
    creadoPor: string | null
    actualizadoPor: string | null
    createdAt: string
    updatedAt: string
}

export interface FuenteRSSItem {
    id: string
    nombre: string
    urlFeed: string
    activo: boolean
    ultimaSincronizacion: string | null
    totalImportadas: number
    createdAt: string
}

async function verifyManagePermission(): Promise<{ usuario: string; isAdmin: boolean }> {
    const session = await getSession()
    if (!session || !session.user) {
        throw new Error('No autorizado: Sesión expirada')
    }

    const roleName = session.user.role?.name?.toLowerCase().trim() || ''
    const perms: string[] = session.user.role?.permissions || []
    const isAdmin = roleName === 'admin' || roleName === 'administrador' || roleName === 'super admin'
    const canManage = isAdmin || perms.includes('manage_mantenedor_colaboradores_configuracion')

    if (!canManage) {
        throw new Error('No tienes permisos suficientes para gestionar la configuración de Colaboradores')
    }

    const usuario = session.user.name || session.user.username || session.user.email || 'Usuario'
    return { usuario, isAdmin }
}

export async function obtenerNoticiasAdminAction(): Promise<{ success: boolean; data?: NoticiaAdminItem[]; error?: string }> {
    try {
        await ensureNoticiasTables()

        // Eliminar automáticamente noticias con más de 2 meses de antigüedad
        await rawPrisma.$executeRawUnsafe(`
            DELETE FROM "noticias_alimentacion"
            WHERE ("fechaPublicacion" IS NOT NULL AND "fechaPublicacion" < NOW() - INTERVAL '2 months')
               OR ("fechaPublicacion" IS NULL AND "createdAt" < NOW() - INTERVAL '2 months');
        `).catch(err => console.warn('[obtenerNoticiasAdminAction] Purga de noticias:', err.message))

        const rows = await rawPrisma.$queryRawUnsafe<any[]>(`
            SELECT 
                "id", "titulo", "fuente", "link", "orden", 
                COALESCE("activo", TRUE) as "activo", 
                COALESCE("esAutomatica", FALSE) as "esAutomatica",
                "resumen", 
                "fechaPublicacion"::text as "fechaPublicacion",
                "creadoPor", "actualizadoPor",
                "createdAt"::text as "createdAt",
                "updatedAt"::text as "updatedAt"
            FROM "noticias_alimentacion"
            WHERE (
                ("fechaPublicacion" IS NOT NULL AND "fechaPublicacion" >= NOW() - INTERVAL '2 months')
                OR ("fechaPublicacion" IS NULL AND "createdAt" >= NOW() - INTERVAL '2 months')
            )
            ORDER BY "orden" ASC, "createdAt" DESC;
        `)

        const data: NoticiaAdminItem[] = rows.map(r => ({
            id: r.id,
            titulo: r.titulo,
            fuente: r.fuente,
            link: r.link,
            orden: Number(r.orden || 1),
            activo: Boolean(r.activo),
            esAutomatica: Boolean(r.esAutomatica),
            resumen: r.resumen || null,
            fechaPublicacion: r.fechaPublicacion || null,
            creadoPor: r.creadoPor || null,
            actualizadoPor: r.actualizadoPor || null,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt
        }))

        return { success: true, data }
    } catch (error: any) {
        console.error('[obtenerNoticiasAdminAction] Error:', error)
        return { success: false, error: error.message || 'Error al obtener noticias' }
    }
}

export async function guardarNoticiaAction(data: {
    id?: string
    titulo: string
    fuente: string
    link: string
    orden?: number
    activo?: boolean
    resumen?: string
}): Promise<{ success: boolean; error?: string; id?: string }> {
    try {
        const { usuario } = await verifyManagePermission()
        await ensureNoticiasTables()

        const titulo = data.titulo.trim()
        const fuente = data.fuente.trim()
        const link = data.link.trim()
        const orden = Number(data.orden || 1)
        const activo = data.activo ?? true
        const resumen = data.resumen?.trim() || null

        if (!titulo) throw new Error('El título de la noticia es obligatorio')
        if (!fuente) throw new Error('La fuente del medio o institución es obligatoria')
        if (!link) throw new Error('El enlace (URL) de la noticia es obligatorio')

        if (data.id) {
            // Edición
            await rawPrisma.$executeRawUnsafe(`
                UPDATE "noticias_alimentacion"
                SET 
                    "titulo" = $1,
                    "fuente" = $2,
                    "link" = $3,
                    "orden" = $4,
                    "activo" = $5,
                    "resumen" = $6,
                    "actualizadoPor" = $7,
                    "updatedAt" = CURRENT_TIMESTAMP
                WHERE "id" = $8;
            `, titulo, fuente, link, orden, activo, resumen, usuario, data.id)

            await logAuditAction({
                username: usuario,
                modulo: 'Mantenedor -> Colaboradores -> Configuración',
                action: 'EDICION',
                detalle: `Editó noticia: "${titulo}" (${fuente})`
            })

            return { success: true, id: data.id }
        } else {
            // Creación
            const id = crypto.randomUUID()
            await rawPrisma.$executeRawUnsafe(`
                INSERT INTO "noticias_alimentacion" (
                    "id", "titulo", "fuente", "link", "orden", "activo", "esAutomatica", "resumen", "creadoPor", "createdAt", "updatedAt"
                ) VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
            `, id, titulo, fuente, link, orden, activo, resumen, usuario)

            await logAuditAction({
                username: usuario,
                modulo: 'Mantenedor -> Colaboradores -> Configuración',
                action: 'CREACION',
                detalle: `Creó noticia: "${titulo}" (${fuente})`
            })

            return { success: true, id }
        }
    } catch (error: any) {
        console.error('[guardarNoticiaAction] Error:', error)
        return { success: false, error: error.message || 'Error al guardar la noticia' }
    }
}

export async function toggleActivoNoticiaAction(id: string, activo: boolean): Promise<{ success: boolean; error?: string }> {
    try {
        const { usuario } = await verifyManagePermission()
        await ensureNoticiasTables()

        await rawPrisma.$executeRawUnsafe(`
            UPDATE "noticias_alimentacion"
            SET "activo" = $1, "actualizadoPor" = $2, "updatedAt" = CURRENT_TIMESTAMP
            WHERE "id" = $3;
        `, activo, usuario, id)

        await logAuditAction({
            username: usuario,
            modulo: 'Mantenedor -> Colaboradores -> Configuración',
            action: activo ? 'ACTIVAR' : 'DESACTIVAR',
            detalle: `${activo ? 'Activó' : 'Desactivó'} noticia ID: ${id}`
        })

        return { success: true }
    } catch (error: any) {
        console.error('[toggleActivoNoticiaAction] Error:', error)
        return { success: false, error: error.message || 'Error al cambiar estado' }
    }
}

export async function eliminarNoticiaAction(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { usuario } = await verifyManagePermission()
        await ensureNoticiasTables()

        await rawPrisma.$executeRawUnsafe(`
            DELETE FROM "noticias_alimentacion" WHERE "id" = $1;
        `, id)

        await logAuditAction({
            username: usuario,
            modulo: 'Mantenedor -> Colaboradores -> Configuración',
            action: 'ELIMINACION',
            detalle: `Eliminó noticia ID: ${id}`
        })

        return { success: true }
    } catch (error: any) {
        console.error('[eliminarNoticiaAction] Error:', error)
        return { success: false, error: error.message || 'Error al eliminar noticia' }
    }
}

export async function obtenerFuentesRSSAction(): Promise<{ success: boolean; data?: FuenteRSSItem[]; error?: string }> {
    try {
        await ensureNoticiasTables()
        const rows = await rawPrisma.$queryRawUnsafe<any[]>(`
            SELECT 
                "id", "nombre", "urlFeed", "activo",
                "ultimaSincronizacion"::text as "ultimaSincronizacion",
                COALESCE("totalImportadas", 0) as "totalImportadas",
                "createdAt"::text as "createdAt"
            FROM "noticias_fuentes_config"
            ORDER BY "createdAt" ASC;
        `)

        const data: FuenteRSSItem[] = rows.map(r => ({
            id: r.id,
            nombre: r.nombre,
            urlFeed: r.urlFeed,
            activo: Boolean(r.activo),
            ultimaSincronizacion: r.ultimaSincronizacion || null,
            totalImportadas: Number(r.totalImportadas || 0),
            createdAt: r.createdAt
        }))

        return { success: true, data }
    } catch (error: any) {
        console.error('[obtenerFuentesRSSAction] Error:', error)
        return { success: false, error: error.message || 'Error al obtener fuentes RSS' }
    }
}

export async function guardarFuenteRSSAction(data: {
    id?: string
    nombre: string
    urlFeed: string
    activo?: boolean
}): Promise<{ success: boolean; error?: string; id?: string }> {
    try {
        const { usuario } = await verifyManagePermission()
        await ensureNoticiasTables()

        const nombre = data.nombre.trim()
        const urlFeed = data.urlFeed.trim()
        const activo = data.activo ?? true

        if (!nombre) throw new Error('El nombre de la fuente es obligatorio')
        if (!urlFeed || !urlFeed.startsWith('http')) throw new Error('La URL del feed RSS debe ser válida (iniciar con http:// o https://)')

        if (data.id) {
            await rawPrisma.$executeRawUnsafe(`
                UPDATE "noticias_fuentes_config"
                SET "nombre" = $1, "urlFeed" = $2, "activo" = $3, "actualizadoPor" = $4, "updatedAt" = CURRENT_TIMESTAMP
                WHERE "id" = $5;
            `, nombre, urlFeed, activo, usuario, data.id)

            await logAuditAction({
                username: usuario,
                modulo: 'Mantenedor -> Colaboradores -> Configuración',
                action: 'EDICION',
                detalle: `Editó fuente RSS: "${nombre}"`
            })

            return { success: true, id: data.id }
        } else {
            const id = crypto.randomUUID()
            await rawPrisma.$executeRawUnsafe(`
                INSERT INTO "noticias_fuentes_config" (
                    "id", "nombre", "urlFeed", "activo", "creadoPor", "createdAt"
                ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP);
            `, id, nombre, urlFeed, activo, usuario)

            await logAuditAction({
                username: usuario,
                modulo: 'Mantenedor -> Colaboradores -> Configuración',
                action: 'CREACION',
                detalle: `Creó fuente RSS: "${nombre}"`
            })

            return { success: true, id }
        }
    } catch (error: any) {
        console.error('[guardarFuenteRSSAction] Error:', error)
        return { success: false, error: error.message || 'Error al guardar fuente RSS' }
    }
}

export async function toggleActivoFuenteRSSAction(id: string, activo: boolean): Promise<{ success: boolean; error?: string }> {
    try {
        const { usuario } = await verifyManagePermission()
        await ensureNoticiasTables()

        await rawPrisma.$executeRawUnsafe(`
            UPDATE "noticias_fuentes_config"
            SET "activo" = $1, "actualizadoPor" = $2, "updatedAt" = CURRENT_TIMESTAMP
            WHERE "id" = $3;
        `, activo, usuario, id)

        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message || 'Error al cambiar estado' }
    }
}

export async function eliminarFuenteRSSAction(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { usuario } = await verifyManagePermission()
        await ensureNoticiasTables()

        await rawPrisma.$executeRawUnsafe(`DELETE FROM "noticias_fuentes_config" WHERE "id" = $1;`, id)
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message || 'Error al eliminar fuente RSS' }
    }
}

// Helper para limpiar tags HTML simples
function cleanHtmlText(raw: string): string {
    return raw
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim()
}

export async function sincronizarNoticiasRSSAction(): Promise<{
    success: boolean
    nuevasImportadas?: number
    totalFuentes?: number
    error?: string
}> {
    try {
        const { usuario } = await verifyManagePermission()
        await ensureNoticiasTables()

        const fuentes = await rawPrisma.$queryRawUnsafe<any[]>(`
            SELECT "id", "nombre", "urlFeed"
            FROM "noticias_fuentes_config"
            WHERE "activo" = TRUE;
        `)

        if (fuentes.length === 0) {
            return { success: false, error: 'No hay fuentes RSS activas configuradas para sincronizar' }
        }

        // Eliminar noticias antiguas con más de 2 meses
        await rawPrisma.$executeRawUnsafe(`
            DELETE FROM "noticias_alimentacion"
            WHERE ("fechaPublicacion" IS NOT NULL AND "fechaPublicacion" < NOW() - INTERVAL '2 months')
               OR ("fechaPublicacion" IS NULL AND "createdAt" < NOW() - INTERVAL '2 months');
        `).catch(err => console.warn('[sincronizarNoticiasRSSAction] Purga:', err.message))

        const twoMonthsAgo = new Date()
        twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)

        // Obtener links existentes para evitar duplicados
        const linksExistentesRows = await rawPrisma.$queryRawUnsafe<any[]>(`
            SELECT "link", "titulo" FROM "noticias_alimentacion";
        `)
        const titulosExistentes = new Set(linksExistentesRows.map(r => r.titulo.toLowerCase().trim()))
        const linksExistentes = new Set(linksExistentesRows.map(r => r.link.toLowerCase().trim()))

        let totalNuevas = 0

        for (const f of fuentes) {
            try {
                const response = await fetch(f.urlFeed, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) HendayaNewsFeed/1.0',
                        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
                    },
                    signal: AbortSignal.timeout(10000)
                })

                if (!response.ok) {
                    console.warn(`[sincronizarNoticiasRSS] Error HTTP ${response.status} en feed: ${f.nombre}`)
                    continue
                }

                const xmlText = await response.text()
                // Parsear items usando regex seguro
                const itemMatches = xmlText.match(/<item[\s\S]*?<\/item>/gi) || []
                let nuevasDeEstaFuente = 0

                for (const itemXml of itemMatches.slice(0, 10)) { // Tomar hasta 10 noticias recientes por feed
                    const titleMatch = itemXml.match(/<title[\s\S]*?>([\s\S]*?)<\/title>/i)
                    const linkMatch = itemXml.match(/<link[\s\S]*?>([\s\S]*?)<\/link>/i)
                    const sourceMatch = itemXml.match(/<source[\s\S]*?>([\s\S]*?)<\/source>/i)
                    const pubDateMatch = itemXml.match(/<pubDate[\s\S]*?>([\s\S]*?)<\/pubDate>/i)

                    if (!titleMatch || !linkMatch) continue

                    const rawTitle = cleanHtmlText(titleMatch[1] || '')
                    const rawLink = cleanHtmlText(linkMatch[1] || '')
                    const rawSource = sourceMatch ? cleanHtmlText(sourceMatch[1] || '') : f.nombre.split('-')[0].trim()
                    const pubDate = pubDateMatch ? new Date(pubDateMatch[1]) : new Date()

                    if (pubDate < twoMonthsAgo) continue

                    if (!rawTitle || !rawLink) continue

                    const cleanTitleKey = rawTitle.toLowerCase().trim()
                    const cleanLinkKey = rawLink.toLowerCase().trim()

                    if (titulosExistentes.has(cleanTitleKey) || linksExistentes.has(cleanLinkKey)) {
                        continue // Ya existe
                    }

                    // Insertar como noticia automática
                    const id = crypto.randomUUID()
                    await rawPrisma.$executeRawUnsafe(`
                        INSERT INTO "noticias_alimentacion" (
                            "id", "titulo", "fuente", "link", "orden", "activo", "esAutomatica", "fechaPublicacion", "creadoPor", "createdAt", "updatedAt"
                        ) VALUES ($1, $2, $3, $4, 1, TRUE, TRUE, $5, 'RSS_SYNC', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                        ON CONFLICT ("id") DO NOTHING;
                    `, id, rawTitle, rawSource || 'Prensa Nacional', rawLink, pubDate)

                    titulosExistentes.add(cleanTitleKey)
                    linksExistentes.add(cleanLinkKey)
                    nuevasDeEstaFuente++
                    totalNuevas++
                }

                // Actualizar timestamp de la fuente
                await rawPrisma.$executeRawUnsafe(`
                    UPDATE "noticias_fuentes_config"
                    SET "ultimaSincronizacion" = CURRENT_TIMESTAMP,
                        "totalImportadas" = COALESCE("totalImportadas", 0) + $1
                    WHERE "id" = $2;
                `, nuevasDeEstaFuente, f.id)

            } catch (feedErr: any) {
                console.error(`[sincronizarNoticiasRSS] Error procesando fuente ${f.nombre}:`, feedErr.message)
            }
        }

        await logAuditAction({
            username: usuario,
            modulo: 'Mantenedor -> Colaboradores -> Configuración',
            action: 'SINCRONIZACION',
            detalle: `Sincronizó fuentes RSS de noticias. Nuevas noticias importadas: ${totalNuevas}`
        })

        return {
            success: true,
            nuevasImportadas: totalNuevas,
            totalFuentes: fuentes.length
        }
    } catch (error: any) {
        console.error('[sincronizarNoticiasRSSAction] Error:', error)
        return { success: false, error: error.message || 'Error al ejecutar sincronización RSS' }
    }
}
