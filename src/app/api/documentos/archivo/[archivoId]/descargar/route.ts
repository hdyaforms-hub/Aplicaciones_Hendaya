import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { logAuditAction } from '@/lib/audit'
import { getFileStream, getFileMetadata } from '@/lib/graph-client'

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ archivoId: string }> }
) {
    try {
        const session = await getSession()
        if (!session?.user) {
            return NextResponse.json({ message: 'No autenticado' }, { status: 401 })
        }

        const { archivoId } = await context.params

        // Obtener metadatos para nombre exacto
        let filename = 'documento'
        try {
            const meta = await getFileMetadata(archivoId)
            if (meta?.name) {
                filename = meta.name
            }
        } catch {}

        const streamResult = await getFileStream(archivoId)

        if (!streamResult.body) {
            return NextResponse.json({ message: 'No se pudo descargar el archivo' }, { status: 404 })
        }

        // Registrar auditoría de descarga
        await logAuditAction({
            username: session.user.username,
            userId: session.user.id,
            action: 'DESCARGA_DOCUMENTO',
            modulo: 'GESTOR_DOCUMENTAL',
            detalle: `Descargó el archivo "${filename}" (ID: ${archivoId})`
        })

        const headers = new Headers()
        headers.set('Content-Type', streamResult.contentType || 'application/octet-stream')
        headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
        headers.set('X-Content-Type-Options', 'nosniff')

        if (streamResult.contentLength !== undefined) {
            headers.set('Content-Length', streamResult.contentLength.toString())
        }

        return new NextResponse(streamResult.body as any, {
            status: 200,
            headers
        })
    } catch (error: any) {
        console.error('Error al descargar archivo:', error?.message)
        return NextResponse.json({ message: 'Error al procesar la descarga' }, { status: 500 })
    }
}
