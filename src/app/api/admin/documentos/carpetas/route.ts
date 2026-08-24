import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { rawPrisma } from '@/lib/prisma'
import { isGlobalDocAdmin, normalizeUserPermissions } from '@/lib/doc-permissions'
import { createFolder } from '@/lib/graph-client'
import { logAuditAction } from '@/lib/audit'
import { CarpetaUI } from '@/types/documentos'

export async function GET() {
    try {
        const session = await getSession()
        if (!session?.user) {
            return NextResponse.json({ message: 'No autenticado' }, { status: 401 })
        }

        const permissions = normalizeUserPermissions(session.user.role?.permissions)
        const canManage = isGlobalDocAdmin(session.user) || permissions.includes('manage_doc_carpetas') || permissions.includes('manage_doc_privilegios')

        if (!canManage) {
            return NextResponse.json({ message: 'Acceso no autorizado' }, { status: 403 })
        }

        const carpetas = await rawPrisma.carpetaDocumental.findMany({
            orderBy: [
                { orden: 'asc' },
                { nombre: 'asc' }
            ],
            include: {
                _count: {
                    select: { privilegios: true }
                }
            }
        })

        const carpetasUI: CarpetaUI[] = carpetas.map(c => ({
            id: c.id,
            nombre: c.nombre,
            descripcion: c.descripcion,
            icono: c.icono || '📁',
            parentId: c.parentId,
            rutaCompleta: c.rutaCompleta,
            orden: c.orden,
            activa: c.activa,
            puedeVer: true,
            puedeDescargar: true,
            puedeSubir: true,
            puedeAdministrar: true
        }))

        // Armar árbol jerárquico
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

        return NextResponse.json({ carpetas: rootFolders, todas: carpetasUI })
    } catch (error: any) {
        console.error('Error al listar carpetas en administración:', error?.message)
        return NextResponse.json({ message: 'Error interno' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getSession()
        if (!session?.user) {
            return NextResponse.json({ message: 'No autenticado' }, { status: 401 })
        }

        const permissions = normalizeUserPermissions(session.user.role?.permissions)
        const canManage = isGlobalDocAdmin(session.user) || permissions.includes('manage_doc_carpetas')

        if (!canManage) {
            return NextResponse.json({ message: 'Acceso no autorizado' }, { status: 403 })
        }

        const body = await request.json()
        const { nombre, descripcion, parentId, icono, orden } = body

        if (!nombre || !nombre.trim()) {
            return NextResponse.json({ message: 'El nombre de la carpeta es requerido' }, { status: 400 })
        }

        let parentOnedriveId: string | null = null
        let parentRuta = ''

        if (parentId) {
            const parent = await rawPrisma.carpetaDocumental.findUnique({
                where: { id: parentId }
            })
            if (parent) {
                parentOnedriveId = parent.onedriveId
                parentRuta = parent.rutaCompleta ? `${parent.rutaCompleta}/` : ''
            }
        }

        const folderNameClean = nombre.trim()
        const rutaCompleta = `${parentRuta}${folderNameClean}`

        // 1. Crear carpeta en OneDrive mediante Graph API
        const driveItem = await createFolder(parentOnedriveId, folderNameClean)

        // 2. Registrar en la base de datos
        const nuevaCarpeta = await rawPrisma.carpetaDocumental.create({
            data: {
                onedriveId: driveItem.id,
                nombre: folderNameClean,
                descripcion: descripcion?.trim() || null,
                parentId: parentId || null,
                rutaCompleta,
                icono: icono || '📁',
                orden: Number(orden) || 0,
                activa: true
            }
        })

        // Auditoría
        await logAuditAction({
            username: session.user.username,
            userId: session.user.id,
            action: 'CREAR_CARPETA_DOCUMENTAL',
            modulo: 'GESTOR_DOCUMENTAL',
            detalle: `Creó la carpeta "${folderNameClean}" en ruta "${rutaCompleta}"`
        })

        return NextResponse.json({ success: true, carpeta: nuevaCarpeta })
    } catch (error: any) {
        console.error('Error al crear carpeta:', error?.message)
        return NextResponse.json({ message: error?.message || 'Error al crear carpeta' }, { status: 500 })
    }
}
