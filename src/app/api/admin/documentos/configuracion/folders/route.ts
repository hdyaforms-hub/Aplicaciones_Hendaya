import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { isGlobalDocAdmin, normalizeUserPermissions } from '@/lib/doc-permissions'
import { listOneDriveFolders, saveRootFolder } from '@/lib/graph-client'
import { logAuditAction } from '@/lib/audit'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
    try {
        const session = await getSession()
        if (!session?.user) {
            return NextResponse.json({ message: 'No autenticado' }, { status: 401 })
        }

        const permissions = normalizeUserPermissions(session.user.role?.permissions)
        const canManage = isGlobalDocAdmin(session.user) || permissions.includes('manage_doc_configuracion')

        if (!canManage) {
            return NextResponse.json({ message: 'Acceso no autorizado' }, { status: 403 })
        }

        const { searchParams } = new URL(request.url)
        const folderId = searchParams.get('folderId') || 'root'

        const folders = await listOneDriveFolders(folderId)

        return NextResponse.json({
            success: true,
            folders: folders.map(f => ({
                id: f.id,
                name: f.name,
                childCount: f.folder?.childCount || 0
            }))
        })
    } catch (error: any) {
        console.error('Error al listar subcarpetas de OneDrive:', error?.message)
        return NextResponse.json({
            success: false,
            message: error?.message || 'Error al listar carpetas de OneDrive'
        }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getSession()
        if (!session?.user) {
            return NextResponse.json({ message: 'No autenticado' }, { status: 401 })
        }

        const permissions = normalizeUserPermissions(session.user.role?.permissions)
        const canManage = isGlobalDocAdmin(session.user) || permissions.includes('manage_doc_configuracion')

        if (!canManage) {
            return NextResponse.json({ message: 'Acceso no autorizado' }, { status: 403 })
        }

        const body = await request.json()
        const { rootFolderId, rootFolderName } = body

        const saved = await saveRootFolder(rootFolderId, rootFolderName)
        if (!saved) {
            return NextResponse.json({ message: 'Error al persistir la carpeta raíz' }, { status: 500 })
        }

        await logAuditAction({
            username: session.user.username,
            userId: session.user.id,
            action: 'CARPETA_RAIZ_ONEDRIVE_ACTUALIZADA',
            modulo: 'GESTOR_DOCUMENTAL',
            detalle: `Estableció la carpeta raíz en: ${rootFolderName || 'Raíz Completa'} (${rootFolderId || 'root'})`
        })

        return NextResponse.json({
            success: true,
            message: `Carpeta raíz establecida en: ${rootFolderName || 'Raíz de OneDrive'}`
        })
    } catch (error: any) {
        console.error('Error al guardar carpeta raíz:', error?.message)
        return NextResponse.json({
            success: false,
            message: error?.message || 'Error al guardar carpeta raíz'
        }, { status: 500 })
    }
}
