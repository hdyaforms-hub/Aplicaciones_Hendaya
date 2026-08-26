import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { rawPrisma } from '@/lib/prisma'
import { getFolderIdsForUser, getUserFolderPermissions } from '@/lib/doc-permissions'
import { CarpetaUI } from '@/types/documentos'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
    try {
        const session = await getSession()
        if (!session?.user) {
            return NextResponse.json({ message: 'No autenticado' }, { status: 401 })
        }

        const allowedFolderIds = await getFolderIdsForUser(session.user)

        if (allowedFolderIds.length === 0) {
            return NextResponse.json({ carpetas: [] })
        }

        // Obtener carpetas activas de la BD
        const carpetas = await rawPrisma.carpetaDocumental.findMany({
            where: {
                id: { in: allowedFolderIds },
                activa: true
            },
            orderBy: [
                { orden: 'asc' },
                { nombre: 'asc' }
            ]
        })

        // Mapear con permisos de usuario por carpeta
        const carpetasUI: CarpetaUI[] = await Promise.all(
            carpetas.map(async (c) => {
                const perms = await getUserFolderPermissions(session.user, c.id)
                return {
                    id: c.id,
                    nombre: c.nombre,
                    descripcion: c.descripcion,
                    icono: c.icono || '📁',
                    parentId: c.parentId,
                    rutaCompleta: c.rutaCompleta,
                    orden: c.orden,
                    activa: c.activa,
                    puedeVer: perms.puedeVer,
                    puedeDescargar: perms.puedeDescargar,
                    puedeSubir: perms.puedeSubir,
                    puedeAdministrar: perms.puedeAdministrar
                }
            })
        )

        // Construir estructura de árbol
        const map = new Map<string, CarpetaUI>()
        carpetasUI.forEach(c => map.set(c.id, { ...c, subCarpetas: [] }))

        const rootFolders: CarpetaUI[] = []

        carpetasUI.forEach(c => {
            const item = map.get(c.id)!
            if (c.parentId && map.has(c.parentId)) {
                map.get(c.parentId)!.subCarpetas!.push(item)
            } else {
                rootFolders.push(item)
            }
        })

        return NextResponse.json({ carpetas: rootFolders })
    } catch (error: any) {
        console.error('Error al listar carpetas de usuario:', error?.message)
        return NextResponse.json({ message: 'Error al obtener carpetas' }, { status: 500 })
    }
}
