import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { rawPrisma } from '@/lib/prisma'
import { isGlobalDocAdmin, normalizeUserPermissions } from '@/lib/doc-permissions'
import { uploadFile, deleteItem } from '@/lib/graph-client'
import { logAuditAction } from '@/lib/audit'

export const dynamic = 'force-dynamic'
export const maxDuration = 180 // 3 minutos para subida de videos/archivos pesados

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ carpetaId: string }> }
) {
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

        const { carpetaId } = await context.params

        const carpeta = await rawPrisma.carpetaDocumental.findUnique({
            where: { id: carpetaId }
        })

        if (!carpeta) {
            return NextResponse.json({ message: 'Carpeta de destino no encontrada' }, { status: 404 })
        }

        const formData = await request.formData()
        const file = formData.get('file') as File | null

        if (!file) {
            return NextResponse.json({ message: 'No se ha proporcionado ningún archivo' }, { status: 400 })
        }

        // Límite de 250MB (apto para videos explicativos, capacitaciones y documentos extensos)
        const MAX_MB = 250
        if (file.size > MAX_MB * 1024 * 1024) {
            return NextResponse.json({ message: `El archivo "${file.name}" excede el tamaño máximo permitido (${MAX_MB}MB)` }, { status: 400 })
        }

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const mimeType = file.type || 'application/octet-stream'

        // Subir a OneDrive
        const uploadedItem = await uploadFile(carpeta.onedriveId, file.name, buffer, mimeType)

        // Registrar auditoría
        await logAuditAction({
            username: session.user.username,
            userId: session.user.id,
            action: 'SUBIDA_DOCUMENTO',
            modulo: 'GESTOR_DOCUMENTAL',
            detalle: `Subió el archivo "${file.name}" (${(file.size / (1024 * 1024)).toFixed(2)} MB) a la carpeta "${carpeta.nombre}"`
        })

        return NextResponse.json({
            success: true,
            archivo: {
                id: uploadedItem.id,
                name: uploadedItem.name,
                size: uploadedItem.size,
                lastModifiedDateTime: uploadedItem.lastModifiedDateTime
            }
        })
    } catch (error: any) {
        console.error('Error al subir archivo a OneDrive:', error?.message)
        return NextResponse.json({ message: error?.message || 'Error al subir archivo' }, { status: 500 })
    }
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ carpetaId: string }> }
) {
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

        const { searchParams } = new URL(request.url)
        const archivoId = searchParams.get('archivoId')
        const archivoNombre = searchParams.get('nombre') || 'archivo'

        if (!archivoId) {
            return NextResponse.json({ message: 'ID de archivo requerido' }, { status: 400 })
        }

        await deleteItem(archivoId)

        await logAuditAction({
            username: session.user.username,
            userId: session.user.id,
            action: 'ELIMINAR_DOCUMENTO',
            modulo: 'GESTOR_DOCUMENTAL',
            detalle: `Eliminó el archivo "${archivoNombre}" (OneDrive ID: ${archivoId})`
        })

        return NextResponse.json({ success: true, message: 'Archivo eliminado' })
    } catch (error: any) {
        console.error('Error al eliminar archivo:', error?.message)
        return NextResponse.json({ message: error?.message || 'Error al eliminar archivo' }, { status: 500 })
    }
}
