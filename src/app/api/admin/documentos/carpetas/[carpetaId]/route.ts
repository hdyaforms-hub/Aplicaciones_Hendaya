import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { rawPrisma } from '@/lib/prisma'
import { isGlobalDocAdmin, normalizeUserPermissions } from '@/lib/doc-permissions'
import { deleteItem } from '@/lib/graph-client'
import { logAuditAction } from '@/lib/audit'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function PUT(
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
        const body = await request.json()
        const { nombre, descripcion, icono, orden, activa } = body

        const updated = await rawPrisma.carpetaDocumental.update({
            where: { id: carpetaId },
            data: {
                ...(nombre ? { nombre: nombre.trim() } : {}),
                ...(descripcion !== undefined ? { descripcion: descripcion?.trim() || null } : {}),
                ...(icono ? { icono } : {}),
                ...(orden !== undefined ? { orden: Number(orden) } : {}),
                ...(activa !== undefined ? { activa: Boolean(activa) } : {})
            }
        })

        await logAuditAction({
            username: session.user.username,
            userId: session.user.id,
            action: 'ACTUALIZAR_CARPETA_DOCUMENTAL',
            modulo: 'GESTOR_DOCUMENTAL',
            detalle: `Actualizó datos de la carpeta "${updated.nombre}" (ID: ${carpetaId})`
        })

        return NextResponse.json({ success: true, carpeta: updated })
    } catch (error: any) {
        console.error('Error al actualizar carpeta:', error?.message)
        return NextResponse.json({ message: error?.message || 'Error al actualizar carpeta' }, { status: 500 })
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

        const { carpetaId } = await context.params

        const carpeta = await rawPrisma.carpetaDocumental.findUnique({
            where: { id: carpetaId }
        })

        if (!carpeta) {
            return NextResponse.json({ message: 'Carpeta no encontrada' }, { status: 404 })
        }

        // 1. Intentar eliminar en OneDrive
        try {
            await deleteItem(carpeta.onedriveId)
        } catch (e: any) {
            console.warn('Advertencia al eliminar en OneDrive:', e?.message)
        }

        // 2. Eliminar en BD (las relaciones de privilegios se eliminan en cascada)
        await rawPrisma.carpetaDocumental.delete({
            where: { id: carpetaId }
        })

        await logAuditAction({
            username: session.user.username,
            userId: session.user.id,
            action: 'ELIMINAR_CARPETA_DOCUMENTAL',
            modulo: 'GESTOR_DOCUMENTAL',
            detalle: `Eliminó la carpeta "${carpeta.nombre}" (OneDrive ID: ${carpeta.onedriveId})`
        })

        return NextResponse.json({ success: true, message: 'Carpeta eliminada' })
    } catch (error: any) {
        console.error('Error al eliminar carpeta:', error?.message)
        return NextResponse.json({ message: error?.message || 'Error al eliminar carpeta' }, { status: 500 })
    }
}
